import { BadRequestException, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { newId } from "../../common/id";
import { PrismaService } from "../../infrastructure/database/prisma.service";

interface PricingInput {
  [key: string]: unknown;
}

interface CostRate {
  value?: unknown;
  unit?: unknown;
  currency?: unknown;
  conditions?: unknown;
}

interface ActualTokenUsage {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
  totalTokens: number;
  generationId?: string;
}

/** 计算模型积分并维护生成用量、预扣及返还流水。 */
@Injectable()
export class PricingService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 根据模型和生成参数匹配优先级最高的价格规则。
   *
   * @param modelId - 平台模型标识。
   * @param input - 影响计费的生成参数。
   * @param channelId - 实际命中的渠道；结算时用于按真实供应成本重算。
   * @returns 积分报价及不可变价格快照。
   */
  async quote(modelId: string, input: PricingInput, channelId?: string) {
    const rules = await this.prisma.modelPricingRule.findMany({
      where: { modelId, enabled: true },
      orderBy: [{ priority: "asc" }, { version: "desc" }, { createdAt: "desc" }],
    });
    const rule = rules.find((candidate) => this.matches(candidate.conditions, input));
    if (!rule) return this.costBasedQuote(modelId, input, channelId);

    const units = rule.unitField ? this.numericValue(input, rule.unitField) : 1;
    const credits = Math.max(rule.minimumCredits, Math.ceil(rule.creditsPerUnit * units));
    return {
      configured: true,
      quotable: true,
      billingMode: "fixed" as const,
      strategy: "manual-rule" as const,
      ruleId: rule.id,
      credits,
      snapshot: {
        configured: true,
        strategy: "manual-rule",
        ruleId: rule.id,
        name: rule.name,
        version: rule.version,
        conditions: rule.conditions,
        unitField: rule.unitField,
        units,
        creditsPerUnit: rule.creditsPerUnit,
        minimumCredits: rule.minimumCredits,
        credits,
      },
    };
  }

  /**
   * 在供应商调用前预扣积分并创建用量记录。
   *
   * @param ownerId - 用户标识。
   * @param modelId - 平台模型标识。
   * @param input - 本次生成参数。
   * @returns 用量标识、报价和扣费后的余额。
   */
  async reserve(ownerId: string, modelId: string, input: PricingInput) {
    const quote = await this.quote(modelId, input);
    return this.prisma.$transaction(async (transaction) => {
      const account = await transaction.account.findUnique({ where: { userId: ownerId } });
      if (!account) throw new BadRequestException("账户不存在");
      if (quote.credits) {
        const debit = await transaction.account.updateMany({
          where: { userId: ownerId, credits: { gte: quote.credits } },
          data: { credits: { decrement: quote.credits } },
        });
        if (!debit.count) throw new BadRequestException(`积分不足，本次生成需要 ${quote.credits} 积分`);
      }
      const updatedAccount = quote.credits
        ? await transaction.account.findUniqueOrThrow({ where: { userId: ownerId } })
        : account;
      const usage = await transaction.generationUsage.create({
        data: {
          id: newId("usage"),
          ownerId,
          modelId,
          pricingRuleId: quote.ruleId,
          status: "reserved",
          inputSnapshot: input as Prisma.InputJsonValue,
          pricingSnapshot: quote.snapshot as Prisma.InputJsonValue,
          credits: quote.credits,
        },
      });
      const balanceAfter = updatedAccount.credits;
      if (quote.credits)
        await transaction.creditLedgerEntry.create({
          data: {
            id: newId("credit"),
            ownerId,
            usageId: usage.id,
            type: "generation_debit",
            delta: -quote.credits,
            balanceAfter,
            reason: `生成预扣：${modelId}`,
          },
        });
      return { usageId: usage.id, balanceAfter, ...quote };
    }, { isolationLevel: "Serializable" });
  }

  /**
   * 将已成功完成的用量标记为正式消费并关联实际渠道或异步任务。
   *
   * @param usageId - 用量记录标识。
   * @param references - 实际渠道和任务引用。
   * @param actualUsage - 供应商同步返回的实际 Token 用量；存在时执行多退少补。
   * @returns 更新后的用量记录。
   */
  async settle(
    usageId: string,
    references: { channelId?: string; jobId?: string } = {},
    actualUsage?: ActualTokenUsage,
  ) {
    const pending = await this.prisma.generationUsage.findUnique({ where: { id: usageId } });
    if (!pending || !["reserved", "pending_reconciliation"].includes(pending.status)) return pending;
    const snapshot = this.jsonObject(pending.pricingSnapshot);
    const shouldReprice = snapshot.strategy === "provider-cost" && actualUsage && references.channelId;
    const awaitsProviderBill = snapshot.billingMode === "metered" && !actualUsage;
    const finalQuote = shouldReprice
      ? await this.quote(
          pending.modelId,
          {
            ...this.jsonObject(pending.inputSnapshot),
            inputTokens: actualUsage.inputTokens,
            outputTokens: actualUsage.outputTokens,
            cachedInputTokens: actualUsage.cachedInputTokens,
          },
          references.channelId,
        )
      : null;
    const finalCredits = finalQuote?.quotable ? finalQuote.credits : pending.credits;
    const adjustment = finalCredits - pending.credits;

    return this.prisma.$transaction(async (transaction) => {
      const claim = await transaction.generationUsage.updateMany({
        where: { id: usageId, status: { in: ["reserved", "pending_reconciliation"] } },
        data: {
          // TODO(billing-reconciliation): ZenMux 媒体账单延迟 3–5 分钟，接入持久化对账任务后再完成最终扣费。
          status: awaitsProviderBill ? "pending_reconciliation" : "charged",
          ...references,
          credits: finalCredits,
          pricingSnapshot: finalQuote
            ? ({
                ...finalQuote.snapshot,
                estimateCredits: pending.credits,
                actualUsage,
                settledFromActualUsage: true,
              } as Prisma.InputJsonValue)
            : (pending.pricingSnapshot as Prisma.InputJsonValue),
          updatedAt: new Date(),
        },
      });
      if (!claim.count) return transaction.generationUsage.findUnique({ where: { id: usageId } });
      if (adjustment) {
        const account = await transaction.account.update({
          where: { userId: pending.ownerId },
          data: { credits: adjustment > 0 ? { decrement: adjustment } : { increment: Math.abs(adjustment) } },
        });
        await transaction.creditLedgerEntry.create({
          data: {
            id: newId("credit"),
            ownerId: pending.ownerId,
            usageId,
            type: "generation_adjustment",
            delta: -adjustment,
            balanceAfter: account.credits,
            reason: adjustment > 0 ? "按实际 Token 用量补扣" : "按实际 Token 用量退还",
          },
        });
      }
      return transaction.generationUsage.findUnique({ where: { id: usageId } });
    }, { isolationLevel: "Serializable" });
  }

  /**
   * 按异步任务完成其关联用量。
   *
   * @param jobId - 生成任务标识。
   * @param channelId - 实际使用的渠道标识。
   * @returns 更新后的用量；任务尚未关联用量时返回 `null`。
   */
  async settleForJob(jobId: string, channelId?: string) {
    const usage = await this.prisma.generationUsage.findUnique({ where: { jobId }, select: { id: true } });
    return usage ? this.settle(usage.id, { channelId }) : null;
  }

  /**
   * 将运行中的用量关联到实际供应渠道和异步任务，但暂不完成扣费。
   *
   * @param usageId - 用量记录标识。
   * @param references - 实际渠道和任务引用。
   * @returns 更新后的用量记录。
   */
  attach(usageId: string, references: { channelId?: string; jobId?: string }) {
    return this.prisma.generationUsage.update({
      where: { id: usageId },
      data: { ...references, updatedAt: new Date() },
    });
  }

  /**
   * 失败时原路返还预扣积分；重复调用不会重复退款。
   *
   * @param usageId - 用量记录标识。
   * @param reason - 退款原因。
   * @returns 退款后的用量状态。
   */
  async refund(usageId: string, reason: string) {
    return this.prisma.$transaction(async (transaction) => {
      const usage = await transaction.generationUsage.findUnique({ where: { id: usageId } });
      if (!usage || usage.status !== "reserved") return usage;
      const claim = await transaction.generationUsage.updateMany({
        where: { id: usage.id, status: "reserved" },
        data: { status: "refunded", updatedAt: new Date() },
      });
      if (!claim.count) return transaction.generationUsage.findUnique({ where: { id: usage.id } });
      const account = await transaction.account.update({
        where: { userId: usage.ownerId },
        data: { credits: { increment: usage.credits } },
      });
      if (usage.credits)
        await transaction.creditLedgerEntry.create({
          data: {
            id: newId("credit"),
            ownerId: usage.ownerId,
            usageId: usage.id,
            type: "generation_refund",
            delta: usage.credits,
            balanceAfter: account.credits,
            reason: reason.slice(0, 200),
          },
        });
      return transaction.generationUsage.findUnique({ where: { id: usage.id } });
    }, { isolationLevel: "Serializable" });
  }

  /**
   * 按异步任务返还其预扣积分。
   *
   * @param jobId - 生成任务标识。
   * @param reason - 退款原因。
   * @returns 退款后的用量；任务尚未关联用量时返回 `null`。
   */
  async refundForJob(jobId: string, reason: string) {
    const usage = await this.prisma.generationUsage.findUnique({ where: { jobId }, select: { id: true } });
    return usage ? this.refund(usage.id, reason) : null;
  }

  private matches(rawConditions: Prisma.JsonValue, input: PricingInput) {
    if (!rawConditions || typeof rawConditions !== "object" || Array.isArray(rawConditions)) return false;
    return Object.entries(rawConditions).every(([field, expected]) => {
      const actual = this.valueAtPath(input, field);
      return Array.isArray(expected) ? expected.includes(actual as never) : actual === expected;
    });
  }

  /** 根据同步后的供应商成本、积分价值和加价率生成保守报价。 */
  private async costBasedQuote(modelId: string, input: PricingInput, channelId?: string) {
    const model = await this.prisma.modelDefinition.findUnique({ where: { id: modelId } });
    if (!model)
      return this.unavailableQuote(modelId, "模型不存在");
    const channels = await this.prisma.providerChannel.findMany({
      where: channelId
        ? { id: channelId, enabled: true, provider: { enabled: true } }
        : model.isAuto
          ? { enabled: true, provider: { enabled: true }, model: { kind: model.kind, enabled: true, isAuto: false } }
          : { modelId, enabled: true, provider: { enabled: true } },
      orderBy: [{ priority: "asc" }, { id: "asc" }],
    });
    const policy = await this.prisma.billingPolicy.findUnique({ where: { id: "default" } });
    const creditValueCny = Number(policy?.creditValueCny ?? 0.035);
    const markupRate = Number(policy?.markupRate ?? 0.1);
    const usdCnyRate = Number(policy?.usdCnyRate ?? 7.2);
    const meteredRates = this.meteredRates(channels.map((channel) => channel.costPricing), input, {
      creditValueCny,
      markupRate,
      usdCnyRate,
    });
    const estimates = channels.flatMap((channel) => {
      const estimate = this.estimateChannel(model.kind, channel.costPricing, input);
      return estimate
        ? [{ ...estimate, channelId: channel.id, channelLabel: channel.label, costPricing: channel.costPricing }]
        : [];
    });
    if (!estimates.length)
      return this.unavailableQuote(
        modelId,
        "该模型按实际用量结算，生成完成后以供应商账单为准",
        meteredRates,
      );
    const normalized = estimates.map((estimate) => ({
      ...estimate,
      costCny: estimate.currency === "USD" ? estimate.amount * usdCnyRate : estimate.amount,
    }));
    const selected = normalized.reduce((highest, item) => (item.costCny > highest.costCny ? item : highest));
    const selectedMeteredRates = this.meteredRates([selected.costPricing], input, {
      creditValueCny,
      markupRate,
      usdCnyRate,
    });
    const targetSaleCny = selected.costCny * (1 + markupRate);
    const credits = targetSaleCny > 0 ? Math.max(1, Math.ceil(targetSaleCny / creditValueCny)) : 0;
    const chargedValueCny = credits * creditValueCny;
    const estimatedProfitCny = chargedValueCny - selected.costCny;
    const snapshot = {
      configured: true,
      strategy: "provider-cost",
      modelId,
      channelId: selected.channelId,
      costAmount: selected.amount,
      costCurrency: selected.currency,
      costCny: selected.costCny,
      targetSaleCny,
      chargedValueCny,
      estimatedProfitCny,
      credits,
      confidence: selected.confidence,
      assumptions: selected.assumptions,
      billingMode: selectedMeteredRates.length ? "metered" : "fixed",
      meteredRates: selectedMeteredRates,
      policy: { creditValueCny, markupRate, usdCnyRate },
    };
    return {
      configured: true,
      quotable: true,
      billingMode: selectedMeteredRates.length ? "metered" as const : "fixed" as const,
      strategy: "provider-cost" as const,
      ruleId: null,
      credits,
      costCny: this.round(selected.costCny),
      targetSaleCny: this.round(targetSaleCny),
      chargedValueCny: this.round(chargedValueCny),
      estimatedProfitCny: this.round(estimatedProfitCny),
      effectiveMarkupRate: selected.costCny ? this.round(estimatedProfitCny / selected.costCny) : 0,
      confidence: selected.confidence,
      assumptions: selected.assumptions,
      meteredRates: selectedMeteredRates,
      policy: { creditValueCny, markupRate, usdCnyRate },
      snapshot,
    };
  }

  /** 将单条渠道的供应商计费项换算为一次调用的成本。 */
  private estimateChannel(kind: string, rawPricing: Prisma.JsonValue | null, input: PricingInput) {
    if (!rawPricing || typeof rawPricing !== "object" || Array.isArray(rawPricing)) return null;
    const pricing = rawPricing as Record<string, unknown>;
    const assumptions: string[] = [];
    const count = this.optionalNumber(input, "count") ?? 1;
    const seconds = this.optionalNumber(input, "durationSeconds") ?? 5;
    const promptLength =
      this.optionalNumber(input, "promptLength") ?? (typeof input.prompt === "string" ? input.prompt.length : 0);
    const promptTokens = this.optionalNumber(input, "inputTokens") ?? Math.max(1, Math.ceil(promptLength / 2));
    const outputTokens = this.optionalNumber(input, "outputTokens") ?? this.optionalNumber(input, "maxOutputTokens") ?? 1000;
    const cachedInputTokens = Math.min(promptTokens, this.optionalNumber(input, "cachedInputTokens") ?? 0);
    const billableTokens = this.optionalNumber(input, "billableTokens");
    const components: Array<{ amount: number; currency: string; confidence: "high" | "medium" | "low" }> = [];

    const add = (key: string, units: { tokens?: number; seconds?: number; count?: number }, confidence: "high" | "medium" | "low") => {
      const component = this.priceComponent(pricing[key], input, units);
      if (component) components.push({ ...component, confidence });
    };
    add("request", { count: 1 }, "high");
    if (kind === "text") {
      add("prompt", { tokens: promptTokens - cachedInputTokens }, this.optionalNumber(input, "inputTokens") ? "high" : "medium");
      if (cachedInputTokens) {
        const cached = this.priceComponent(pricing.input_cache_read, input, { tokens: cachedInputTokens });
        if (cached) components.push({ ...cached, confidence: "high" });
        else add("prompt", { tokens: cachedInputTokens }, "high");
      }
      add("completion", { tokens: outputTokens }, this.optionalNumber(input, "outputTokens") ? "high" : "medium");
      if (!this.optionalNumber(input, "inputTokens")) assumptions.push(`输入按约 ${promptTokens} tokens 估算`);
      if (!this.optionalNumber(input, "outputTokens")) assumptions.push(`输出按 ${outputTokens} tokens 估算`);
    } else if (kind === "image") {
      add("image", { count }, "high");
      add("prompt", { tokens: promptTokens * count }, "low");
      if (!pricing.image) assumptions.push("供应商目录仅公开媒体 token 价格，最终账单可能不同");
    } else if (kind === "video") {
      const key = input.generateAudio ? "audio_and_video" : "video";
      add(key, { seconds: seconds * count, tokens: billableTokens ? billableTokens * count : undefined }, billableTokens ? "medium" : "high");
      if (this.optionalNumber(input, "durationSeconds") === undefined) assumptions.push("未指定时长，按 5 秒估算");
      if (!billableTokens && this.onlyTokenRates(pricing[key])) return null;
    }
    if (!components.length) return null;
    const currencies = new Set(components.map((component) => component.currency));
    if (currencies.size !== 1 || !["USD", "CNY"].includes(components[0]!.currency)) return null;
    const confidence = components.some((x) => x.confidence === "low")
      ? "low"
      : components.some((x) => x.confidence === "medium")
        ? "medium"
        : "high";
    return {
      amount: components.reduce((sum, component) => sum + component.amount, 0),
      currency: components[0]!.currency,
      confidence,
      assumptions,
    };
  }

  /** 从一组同类费率中选取满足条件后的最高成本，避免故障切换导致倒挂。 */
  private priceComponent(
    rawEntries: unknown,
    input: PricingInput,
    units: { tokens?: number; seconds?: number; count?: number },
  ) {
    if (!Array.isArray(rawEntries)) return null;
    const values = rawEntries.flatMap((raw) => {
      if (!raw || typeof raw !== "object") return [];
      const rate = raw as CostRate;
      if (rate.conditions && !this.matches(rate.conditions as Prisma.JsonValue, input)) return [];
      const value = Number(rate.value);
      const currency = typeof rate.currency === "string" ? rate.currency : "";
      const quantity = this.quantityForUnit(String(rate.unit || ""), units);
      return Number.isFinite(value) && quantity !== null && currency ? [{ amount: value * quantity, currency }] : [];
    });
    return values.length ? values.reduce((highest, item) => (item.amount > highest.amount ? item : highest)) : null;
  }

  private quantityForUnit(unit: string, units: { tokens?: number; seconds?: number; count?: number }) {
    if (unit === "perMTokens") return units.tokens === undefined ? null : units.tokens / 1_000_000;
    if (unit === "perKTokens") return units.tokens === undefined ? null : units.tokens / 1000;
    if (unit === "perToken") return units.tokens ?? null;
    if (unit === "perSecond") return units.seconds ?? null;
    if (unit === "perMinute") return units.seconds === undefined ? null : units.seconds / 60;
    if (["perCount", "perImage", "perRequest"].includes(unit)) return units.count ?? 1;
    return null;
  }

  private onlyTokenRates(rawEntries: unknown) {
    return Array.isArray(rawEntries) && rawEntries.length > 0 && rawEntries.every((entry) => {
      const unit = entry && typeof entry === "object" ? String((entry as CostRate).unit || "") : "";
      return ["perMTokens", "perKTokens", "perToken"].includes(unit);
    });
  }

  /** 将供应商 Token 单价换算为面向用户展示的每百万 Token 积分单价。 */
  private meteredRates(
    rawPricingList: Array<Prisma.JsonValue | null>,
    input: PricingInput,
    policy: { creditValueCny: number; markupRate: number; usdCnyRate: number },
  ) {
    const labels: Record<string, string> = {
      prompt: "输入",
      completion: "输出",
      input_cache_read: "缓存输入",
      input_cache_write: "缓存写入",
      video: "视频",
      audio_and_video: "音视频",
    };
    const rates = new Map<string, number>();
    for (const rawPricing of rawPricingList) {
      if (!rawPricing || typeof rawPricing !== "object" || Array.isArray(rawPricing)) continue;
      for (const [key, rawEntries] of Object.entries(rawPricing)) {
        if (!Array.isArray(rawEntries)) continue;
        for (const raw of rawEntries) {
          if (!raw || typeof raw !== "object") continue;
          const rate = raw as CostRate;
          if (rate.conditions && !this.matches(rate.conditions as Prisma.JsonValue, input)) continue;
          const value = Number(rate.value);
          const currency = String(rate.currency || "");
          const perMillion = this.toPerMillion(value, String(rate.unit || ""));
          if (perMillion === null || !["USD", "CNY"].includes(currency)) continue;
          const costCny = currency === "USD" ? perMillion * policy.usdCnyRate : perMillion;
          const credits = (costCny * (1 + policy.markupRate)) / policy.creditValueCny;
          rates.set(key, Math.max(rates.get(key) ?? 0, credits));
        }
      }
    }
    return [...rates.entries()].map(([key, creditsPerMTokens]) => ({
      key,
      label: labels[key] || key,
      creditsPerMTokens: this.round(creditsPerMTokens),
    }));
  }

  /** 将常见 Token 计价单位统一换算为每百万 Token 成本。 */
  private toPerMillion(value: number, unit: string) {
    if (!Number.isFinite(value) || value < 0) return null;
    if (unit === "perMTokens") return value;
    if (unit === "perKTokens") return value * 1000;
    if (unit === "perToken") return value * 1_000_000;
    return null;
  }

  private unavailableQuote(
    modelId: string,
    reason: string,
    meteredRates: Array<{ key: string; label: string; creditsPerMTokens: number }> = [],
  ) {
    return {
      configured: meteredRates.length > 0,
      quotable: false,
      billingMode: meteredRates.length ? "metered" as const : "unavailable" as const,
      strategy: "unavailable" as const,
      ruleId: null,
      credits: 0,
      reason,
      meteredRates,
      snapshot: {
        configured: meteredRates.length > 0,
        quotable: false,
        billingMode: meteredRates.length ? "metered" : "unavailable",
        modelId,
        reason,
        meteredRates,
      },
    };
  }

  private optionalNumber(input: PricingInput, path: string) {
    const raw = this.valueAtPath(input, path);
    if (raw === undefined || raw === null || raw === "") return undefined;
    const value = Number(raw);
    return Number.isFinite(value) && value >= 0 ? value : undefined;
  }

  private round(value: number) {
    return Math.round(value * 1_000_000) / 1_000_000;
  }

  /** 将 Prisma JSON 安全收敛为普通对象，非对象值回退为空对象。 */
  private jsonObject(value: Prisma.JsonValue) {
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  }

  private numericValue(input: PricingInput, path: string) {
    const value = Number(this.valueAtPath(input, path) ?? 1);
    return Number.isFinite(value) && value > 0 ? value : 1;
  }

  private valueAtPath(input: PricingInput, path: string): unknown {
    return path.split(".").reduce<unknown>((value, key) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
      return (value as Record<string, unknown>)[key];
    }, input);
  }
}
