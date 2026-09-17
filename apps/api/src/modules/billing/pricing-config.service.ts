import { Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { newId } from "../../common/id";
import { PrismaService } from "../../infrastructure/database/prisma.service";

/** 创建或更新模型积分规则所需的字段。 */
export interface PricingRuleInput {
  modelId: string;
  name: string;
  conditions?: Record<string, unknown>;
  unitField?: string | null;
  creditsPerUnit: number;
  minimumCredits?: number;
  priority?: number;
  enabled?: boolean;
}

/** 管理模型积分规则并提供用量、积分流水查询。 */
@Injectable()
export class PricingConfigService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 查询当前积分价值、成本加价率和美元汇率。
   *
   * @returns 当前全局计费策略。
   */
  getPolicy() {
    return this.prisma.billingPolicy.findUniqueOrThrow({ where: { id: "default" } });
  }

  /**
   * 更新全局计费策略。
   *
   * @param input - 积分人民币价值、加价率或美元汇率。
   * @returns 更新后的计费策略。
   */
  updatePolicy(input: { creditValueCny?: number; markupRate?: number; usdCnyRate?: number }) {
    return this.prisma.billingPolicy.update({
      where: { id: "default" },
      data: { ...input, updatedAt: new Date() },
    });
  }

  /**
   * 查询模型价格规则。
   *
   * @param modelId - 可选的平台模型标识。
   * @returns 按模型和匹配优先级排列的价格规则。
   */
  listRules(modelId?: string) {
    return this.prisma.modelPricingRule.findMany({
      where: { modelId },
      include: { model: { select: { label: true, kind: true } } },
      orderBy: [{ modelId: "asc" }, { priority: "asc" }, { version: "desc" }],
    });
  }

  /**
   * 创建一条基于参数条件的模型积分规则。
   *
   * @param input - 匹配条件、计价单位和积分单价。
   * @returns 新建的价格规则。
   */
  async createRule(input: PricingRuleInput) {
    await this.assertModel(input.modelId);
    return this.prisma.modelPricingRule.create({
      data: { id: newId("pricing"), ...input, conditions: (input.conditions || {}) as Prisma.InputJsonValue },
    });
  }

  /**
   * 更新价格规则并递增版本，历史用量仍保留旧快照。
   *
   * @param id - 价格规则标识。
   * @param input - 要更新的规则字段。
   * @returns 更新后的规则。
   */
  async updateRule(id: string, input: Partial<PricingRuleInput>) {
    await this.assertRule(id);
    if (input.modelId) await this.assertModel(input.modelId);
    return this.prisma.modelPricingRule.update({
      where: { id },
      data: {
        ...input,
        conditions: input.conditions as Prisma.InputJsonValue | undefined,
        version: { increment: 1 },
        updatedAt: new Date(),
      },
    });
  }

  /**
   * 删除价格规则；历史用量通过价格快照继续保持完整。
   *
   * @param id - 价格规则标识。
   * @returns 删除结果。
   */
  async removeRule(id: string) {
    await this.assertRule(id);
    await this.prisma.modelPricingRule.delete({ where: { id } });
    return { ok: true };
  }

  /**
   * 查询当前用户的生成用量与对应模型、渠道。
   *
   * @param ownerId - 当前用户标识。
   * @param take - 最大返回数量。
   * @returns 最近的生成用量记录。
   */
  listUsage(ownerId: string, take = 100) {
    return this.prisma.generationUsage.findMany({
      where: { ownerId },
      include: {
        model: { select: { label: true, kind: true } },
        channel: { select: { label: true, provider: { select: { label: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take,
    });
  }

  /**
   * 查询当前用户的积分增减流水。
   *
   * @param ownerId - 当前用户标识。
   * @param take - 最大返回数量。
   * @returns 最近的积分流水。
   */
  listLedger(ownerId: string, take = 100) {
    return this.prisma.creditLedgerEntry.findMany({
      where: { ownerId },
      orderBy: { createdAt: "desc" },
      take,
    });
  }

  private async assertModel(id: string) {
    if (!(await this.prisma.modelDefinition.findUnique({ where: { id }, select: { id: true } })))
      throw new NotFoundException("模型不存在");
  }

  private async assertRule(id: string) {
    if (!(await this.prisma.modelPricingRule.findUnique({ where: { id }, select: { id: true } })))
      throw new NotFoundException("价格规则不存在");
  }
}
