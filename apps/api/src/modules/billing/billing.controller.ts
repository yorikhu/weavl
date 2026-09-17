import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { parseBody, type AuthRequest } from "../../common/http";
import { SessionGuard } from "../auth/session.guard";
import { PricingConfigService } from "./pricing-config.service";
import { PricingService } from "./pricing.service";

const ruleSchema = z.object({
  modelId: z.string().trim().min(1),
  name: z.string().trim().min(1).max(100),
  conditions: z.record(z.string(), z.unknown()).optional(),
  unitField: z.string().trim().max(100).nullable().optional(),
  creditsPerUnit: z.number().int().min(0).max(1_000_000),
  minimumCredits: z.number().int().min(0).max(1_000_000).optional(),
  priority: z.number().int().min(0).max(10_000).optional(),
  enabled: z.boolean().optional(),
});
const quoteSchema = z.object({
  modelId: z.string().trim().min(1),
  parameters: z.record(z.string(), z.unknown()).default({}),
});
const policySchema = z.object({
  creditValueCny: z.number().positive().max(100).optional(),
  markupRate: z.number().min(0).max(10).optional(),
  usdCnyRate: z.number().positive().max(100).optional(),
});

/** 提供模型计价规则、报价、个人用量和积分流水接口。 */
@Controller("studio/billing")
@UseGuards(SessionGuard)
export class BillingController {
  constructor(
    private readonly config: PricingConfigService,
    private readonly pricing: PricingService,
  ) {}

  /** @returns 当前积分价值、成本加价率和美元汇率。 */
  @Get("policy") policy() {
    return this.config.getPolicy();
  }

  /**
   * 更新全局计费策略。
   *
   * @param body - 未校验的计费策略字段。
   * @returns 更新后的计费策略。
   * @todo 后台账号体系上线后改为管理员权限守卫。
   */
  @Patch("policy") updatePolicy(@Body() body: unknown) {
    return this.config.updatePolicy(parseBody(policySchema, body));
  }

  /**
   * 查询价格规则。
   *
   * @param modelId - 可选的平台模型标识。
   * @returns 全部或指定模型的价格规则。
   */
  @Get("pricing-rules") listRules(@Query("modelId") modelId?: string) {
    return this.config.listRules(modelId);
  }

  /**
   * 创建价格规则。
   *
   * @param body - 未校验的规则配置。
   * @returns 新建的规则。
   * @todo 后台账号体系上线后改为管理员权限守卫。
   */
  @Post("pricing-rules") createRule(@Body() body: unknown) {
    return this.config.createRule(parseBody(ruleSchema, body));
  }

  /**
   * 更新价格规则。
   *
   * @param id - 价格规则标识。
   * @param body - 未校验的部分规则配置。
   * @returns 更新后的规则。
   * @todo 后台账号体系上线后改为管理员权限守卫。
   */
  @Patch("pricing-rules/:id") updateRule(@Param("id") id: string, @Body() body: unknown) {
    return this.config.updateRule(id, parseBody(ruleSchema.partial(), body));
  }

  /**
   * 删除价格规则。
   *
   * @param id - 价格规则标识。
   * @returns 删除结果。
   * @todo 后台账号体系上线后改为管理员权限守卫。
   */
  @Delete("pricing-rules/:id") removeRule(@Param("id") id: string) {
    return this.config.removeRule(id);
  }

  /**
   * 根据模型和参数返回当前积分报价，不进行扣费。
   *
   * @param body - 模型标识和生成参数。
   * @returns 匹配规则后的积分报价。
   */
  @Post("quote") quote(@Body() body: unknown) {
    const input = parseBody(quoteSchema, body);
    return this.pricing.quote(input.modelId, input.parameters);
  }

  /**
   * 查询当前用户最近的生成用量。
   *
   * @param request - 当前登录用户请求。
   * @param rawTake - 可选返回数量。
   * @returns 当前用户的生成用量。
   */
  @Get("usage") usage(@Req() request: AuthRequest, @Query("take") rawTake?: string) {
    return this.config.listUsage(request.studioUser.id, this.take(rawTake));
  }

  /**
   * 查询当前用户最近的积分流水。
   *
   * @param request - 当前登录用户请求。
   * @param rawTake - 可选返回数量。
   * @returns 当前用户的积分流水。
   */
  @Get("ledger") ledger(@Req() request: AuthRequest, @Query("take") rawTake?: string) {
    return this.config.listLedger(request.studioUser.id, this.take(rawTake));
  }

  private take(raw?: string) {
    return Math.min(500, Math.max(1, Number(raw) || 100));
  }
}
