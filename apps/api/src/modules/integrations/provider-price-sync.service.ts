import { createHash } from "node:crypto";
import { BadGatewayException, BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { newId } from "../../common/id";
import { PrismaService } from "../../infrastructure/database/prisma.service";

interface ZenMuxCatalogModel {
  id: string;
  pricings?: Record<string, unknown>;
}

/** 人工触发供应商价格目录同步，并保存成本快照和变更历史。 */
@Injectable()
export class ProviderPriceSyncService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 从服务商目录读取最新成本并更新渠道成本，不修改用户积分价格。
   *
   * @param providerId - 服务商标识。
   * @returns 本次同步匹配、变更和缺失渠道的摘要。
   */
  async sync(providerId: string) {
    const provider = await this.prisma.modelProvider.findUnique({
      where: { id: providerId },
      include: { channels: true },
    });
    if (!provider) throw new NotFoundException("服务商不存在");
    if (!provider.pricingUrl || !provider.pricingAdapter)
      throw new BadRequestException("服务商尚未配置价格目录接口");
    if (provider.pricingAdapter !== "zenmux-models")
      throw new BadRequestException(`暂不支持价格适配器：${provider.pricingAdapter}`);

    const syncId = newId("price_sync");
    await this.prisma.providerPriceSync.create({
      data: { id: syncId, providerId, status: "running", sourceUrl: provider.pricingUrl },
    });

    try {
      const catalog = await this.fetchZenMux(provider.pricingUrl, provider.apiKeyEnv);
      const byRemoteModel = new Map(catalog.map((model) => [model.id, model]));
      const matched = provider.channels.flatMap((channel) => {
        const model = byRemoteModel.get(channel.remoteModel);
        return model?.pricings ? [{ channel, model }] : [];
      });
      const missing = provider.channels.filter((channel) => !byRemoteModel.has(channel.remoteModel));
      const snapshot = matched.map(({ model }) => ({ id: model.id, pricings: model.pricings }));
      const checksum = createHash("sha256").update(this.stableJson(snapshot)).digest("hex");
      let changedCount = 0;

      await this.prisma.$transaction(async (transaction) => {
        for (const { channel, model } of matched) {
          const pricing = model.pricings || {};
          if (this.stableJson(channel.costPricing) === this.stableJson(pricing)) continue;
          changedCount += 1;
          const currency = this.currencyOf(pricing);
          await transaction.providerChannel.update({
            where: { id: channel.id },
            data: {
              costPricing: pricing as Prisma.InputJsonValue,
              costCurrency: currency,
              costUpdatedAt: new Date(),
              updatedAt: new Date(),
            },
          });
          await transaction.channelCostVersion.create({
            data: {
              id: newId("channel_cost"),
              channelId: channel.id,
              syncId,
              pricing: pricing as Prisma.InputJsonValue,
              currency,
            },
          });
        }
        await transaction.providerPriceSync.update({
          where: { id: syncId },
          data: {
            status: "succeeded",
            checksum,
            payload: { models: snapshot } as Prisma.InputJsonValue,
            matchedCount: matched.length,
            changedCount,
            missingCount: missing.length,
            completedAt: new Date(),
          },
        });
        await transaction.modelProvider.update({
          where: { id: providerId },
          data: { lastPriceSyncAt: new Date(), updatedAt: new Date() },
        });
      });

      return {
        id: syncId,
        status: "succeeded",
        matchedCount: matched.length,
        changedCount,
        missingCount: missing.length,
        missingModels: missing.map((channel) => channel.remoteModel),
        checksum,
      };
    } catch (error) {
      const message = (error as Error).message || "价格目录同步失败";
      await this.prisma.providerPriceSync.update({
        where: { id: syncId },
        data: { status: "failed", errorMessage: message.slice(0, 1000), completedAt: new Date() },
      });
      if (error instanceof BadRequestException || error instanceof NotFoundException) throw error;
      throw new BadGatewayException(message);
    }
  }

  /**
   * 查询服务商最近的人工价格同步记录。
   *
   * @param providerId - 服务商标识。
   * @param take - 最大返回数量。
   * @returns 不包含完整原始载荷的同步摘要。
   */
  history(providerId: string, take = 50) {
    return this.prisma.providerPriceSync.findMany({
      where: { providerId },
      select: {
        id: true,
        status: true,
        sourceUrl: true,
        checksum: true,
        matchedCount: true,
        changedCount: true,
        missingCount: true,
        errorMessage: true,
        createdAt: true,
        completedAt: true,
      },
      orderBy: { createdAt: "desc" },
      take,
    });
  }

  /**
   * 查询一个渠道的历史成本版本。
   *
   * @param channelId - 渠道标识。
   * @param take - 最大返回数量。
   * @returns 按时间倒序排列的成本版本。
   */
  costHistory(channelId: string, take = 50) {
    return this.prisma.channelCostVersion.findMany({
      where: { channelId },
      include: { sync: { select: { sourceUrl: true, createdAt: true } } },
      orderBy: { createdAt: "desc" },
      take,
    });
  }

  private async fetchZenMux(url: string, apiKeyEnv: string): Promise<ZenMuxCatalogModel[]> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Number(process.env.WEAVL_PROVIDER_TIMEOUT_MS || 30000));
    try {
      const key = process.env[apiKeyEnv];
      const response = await fetch(url, {
        headers: key ? { Authorization: `Bearer ${key}` } : undefined,
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`价格目录返回 ${response.status}`);
      const body = (await response.json()) as { data?: ZenMuxCatalogModel[] };
      if (!Array.isArray(body.data)) throw new Error("价格目录响应缺少 data 数组");
      return body.data.filter((model) => typeof model.id === "string");
    } finally {
      clearTimeout(timer);
    }
  }

  private currencyOf(pricing: Record<string, unknown>) {
    const currencies = new Set<string>();
    for (const entries of Object.values(pricing))
      if (Array.isArray(entries))
        for (const entry of entries)
          if (entry && typeof entry === "object" && typeof (entry as { currency?: unknown }).currency === "string")
            currencies.add((entry as { currency: string }).currency);
    return currencies.size === 1 ? [...currencies][0] : currencies.size ? "mixed" : null;
  }

  private stableJson(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map((item) => this.stableJson(item)).join(",")}]`;
    if (value && typeof value === "object")
      return `{${Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => `${JSON.stringify(key)}:${this.stableJson(item)}`)
        .join(",")}}`;
    return JSON.stringify(value) ?? "null";
  }
}
