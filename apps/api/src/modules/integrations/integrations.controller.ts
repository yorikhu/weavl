import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { AuthRequest } from "../../common/http";
import { parseBody } from "../../common/http";
import { PrismaService } from "../../infrastructure/database/prisma.service";
import { SessionGuard } from "../auth/session.guard";
import { IntegrationConfigService } from "./integration-config.service";
import { ProviderRegistryService } from "./provider-registry.service";
import { ProviderPriceSyncService } from "./provider-price-sync.service";

const providerSchema = z.object({
  code: z.string().trim().min(1).max(50).regex(/^[a-z0-9][a-z0-9-]*$/),
  label: z.string().trim().min(1).max(100),
  apiKeyEnv: z.string().trim().min(1).max(100).regex(/^[A-Z][A-Z0-9_]*$/),
  enabled: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  pricingAdapter: z.string().trim().max(50).nullable().optional(),
  pricingUrl: z.string().trim().url().max(500).nullable().optional(),
});
const modelSchema = z.object({
  id: z.string().trim().min(1).max(100).regex(/^[a-z0-9][a-z0-9._-]*$/),
  kind: z.enum(["text", "image", "video", "audio", "avatar"]),
  label: z.string().trim().min(1).max(120),
  maker: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500),
  isAuto: z.boolean().optional(),
  enabled: z.boolean().optional(),
  capabilities: z.record(z.string(), z.unknown()).optional(),
});
const channelSchema = z.object({
  providerId: z.string().trim().min(1),
  modelId: z.string().trim().min(1),
  protocol: z.enum(["openai-chat", "vertex-image", "vertex-generate-content", "vertex-video"]),
  remoteModel: z.string().trim().min(1).max(200),
  label: z.string().trim().min(1).max(120),
  baseUrl: z.string().trim().url().max(500),
  priority: z.number().int().min(0).max(10000).optional(),
  enabled: z.boolean().optional(),
  failureThreshold: z.number().int().min(1).max(100).optional(),
  cooldownSeconds: z.number().int().min(0).max(86400).optional(),
});

/** 提供供应渠道状态、调用历史和聚合指标的内部管理接口。 */
@Controller("studio/integrations")
@UseGuards(SessionGuard)
export class IntegrationsController {
  constructor(
    private readonly registry: ProviderRegistryService,
    private readonly config: IntegrationConfigService,
    private readonly priceSync: ProviderPriceSyncService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * 返回基础设施状态和不含密钥值的供应渠道摘要。
   *
   * @param _request - 已通过会话守卫校验的请求对象。
   * @returns 数据库、缓存、对象存储及模型渠道状态。
   */
  @Get() async status(@Req() _request: AuthRequest) {
    void _request;
    const channels = await this.registry.list();
    return {
      mode: "database",
      persistence: "postgresql-prisma",
      cache: "redis",
      objectStorage: "minio",
      providers: channels.map((x) => ({
        id: x.id,
        provider: x.provider,
        protocol: x.protocol,
        modelKind: x.modelKind,
        modelId: x.modelId,
        label: x.label,
        priority: x.priority,
        configured: Boolean(process.env[x.apiKeyEnv]),
        active: x.enabled,
      })),
      nextStorage: { postgresConfigured: true, redisConfigured: true, objectStoreConfigured: true },
    };
  }

  /**
   * 查询数据库维护的服务商配置。
   *
   * @returns 不包含任何密钥值的服务商列表。
   */
  @Get("providers") listProviders() {
    return this.config.listProviders();
  }

  /**
   * 创建服务商配置。
   *
   * @param body - 未校验的服务商配置。
   * @returns 新建的服务商。
   * @todo 后台账号体系上线后改为管理员权限守卫。
   */
  @Post("providers") createProvider(@Body() body: unknown) {
    return this.config.createProvider(parseBody(providerSchema, body));
  }

  /**
   * 更新服务商配置。
   *
   * @param id - 服务商标识。
   * @param body - 未校验的部分服务商配置。
   * @returns 更新后的服务商。
   * @todo 后台账号体系上线后改为管理员权限守卫。
   */
  @Patch("providers/:id") updateProvider(@Param("id") id: string, @Body() body: unknown) {
    return this.config.updateProvider(id, parseBody(providerSchema.partial(), body));
  }

  /**
   * 删除未被渠道引用的服务商。
   *
   * @param id - 服务商标识。
   * @returns 删除结果。
   * @todo 后台账号体系上线后改为管理员权限守卫。
   */
  @Delete("providers/:id") removeProvider(@Param("id") id: string) {
    return this.config.removeProvider(id);
  }

  /**
   * 人工触发一次服务商成本目录同步，不修改用户积分价格。
   *
   * @param id - 服务商标识。
   * @returns 本次同步的匹配、变更和缺失摘要。
   * @todo 后台账号体系上线后改为管理员权限守卫。
   */
  @Post("providers/:id/prices/sync") syncProviderPrices(@Param("id") id: string) {
    return this.priceSync.sync(id);
  }

  /**
   * 查询服务商的人工成本同步历史。
   *
   * @param id - 服务商标识。
   * @param rawTake - 可选返回数量。
   * @returns 最近的同步状态和变更统计。
   */
  @Get("providers/:id/prices/history") providerPriceHistory(
    @Param("id") id: string,
    @Query("take") rawTake?: string,
  ) {
    return this.priceSync.history(id, this.take(rawTake));
  }

  /**
   * 查询完整模型配置。
   *
   * @returns 数据库维护的完整模型定义。
   */
  @Get("models") listModels() {
    return this.config.listModels();
  }

  /**
   * 创建平台模型定义。
   *
   * @param body - 未校验的模型配置。
   * @returns 新建的模型定义。
   * @todo 后台账号体系上线后改为管理员权限守卫。
   */
  @Post("models") createModel(@Body() body: unknown) {
    return this.config.createModel(parseBody(modelSchema, body));
  }

  /**
   * 更新模型定义。
   *
   * @param id - 平台模型标识。
   * @param body - 未校验的部分模型配置。
   * @returns 更新后的模型定义。
   * @todo 后台账号体系上线后改为管理员权限守卫。
   */
  @Patch("models/:id") updateModel(@Param("id") id: string, @Body() body: unknown) {
    const { id: _id, ...input } = parseBody(modelSchema.partial(), body);
    void _id;
    return this.config.updateModel(id, input);
  }

  /**
   * 删除未被渠道引用的模型定义。
   *
   * @param id - 平台模型标识。
   * @returns 删除结果。
   * @todo 后台账号体系上线后改为管理员权限守卫。
   */
  @Delete("models/:id") removeModel(@Param("id") id: string) {
    return this.config.removeModel(id);
  }

  /**
   * 查询供应渠道配置。
   *
   * @returns 包含 BaseURL、协议和路由策略的全部渠道。
   */
  @Get("channels") listChannels() {
    return this.config.listChannels();
  }

  /**
   * 创建供应渠道。
   *
   * @param body - 未校验的渠道配置。
   * @returns 新建的供应渠道。
   * @todo 后台账号体系上线后改为管理员权限守卫。
   */
  @Post("channels") createChannel(@Body() body: unknown) {
    return this.config.createChannel(parseBody(channelSchema, body));
  }

  /**
   * 更新渠道连接与路由配置。
   *
   * @param id - 渠道标识。
   * @param body - 未校验的部分渠道配置。
   * @returns 更新后的供应渠道。
   * @todo 后台账号体系上线后改为管理员权限守卫。
   */
  @Patch("channels/:id") updateChannel(@Param("id") id: string, @Body() body: unknown) {
    return this.config.updateChannel(id, parseBody(channelSchema.partial(), body));
  }

  /**
   * 删除供应渠道。
   *
   * @param id - 渠道标识。
   * @returns 删除结果。
   * @todo 后台账号体系上线后改为管理员权限守卫。
   */
  @Delete("channels/:id") removeChannel(@Param("id") id: string) {
    return this.config.removeChannel(id);
  }

  /**
   * 查询渠道成本价格的历史版本。
   *
   * @param id - 渠道标识。
   * @param rawTake - 可选返回数量。
   * @returns 渠道成本版本。
   */
  @Get("channels/:id/cost-history") channelCostHistory(@Param("id") id: string, @Query("take") rawTake?: string) {
    return this.priceSync.costHistory(id, this.take(rawTake));
  }

  /**
   * 查询最近 200 条调用记录，可按渠道过滤。
   *
   * @param channelId - 可选供应渠道 ID。
   * @returns 按时间倒序排列的调用历史。
   */
  @Get("history") history(@Query("channelId") channelId?: string) {
    return this.prisma.providerRequestLog.findMany({
      where: { channelId },
      include: {
        channel: { select: { label: true, provider: { select: { code: true, label: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  /**
   * 按时间窗口聚合各渠道成功率、调用量和平均延迟。
   *
   * @param rawHours - 查询窗口小时数，限制在 1 小时至 90 天。
   * @returns 每条渠道在指定时间窗口内的聚合指标。
   */
  @Get("metrics")
  async metrics(@Query("hours") rawHours?: string) {
    const hours = Math.min(24 * 90, Math.max(1, Number(rawHours) || 24));
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const [channels, groups] = await Promise.all([
      this.prisma.providerChannel.findMany({
        include: { provider: true, model: true },
        orderBy: [{ model: { kind: "asc" } }, { modelId: "asc" }],
      }),
      this.prisma.providerRequestLog.groupBy({
        by: ["channelId", "status"],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
        _avg: { latencyMs: true },
      }),
    ]);

    return {
      since,
      hours,
      channels: channels.map((channel) => {
        const channelGroups = groups.filter((group) => group.channelId === channel.id);
        const total = channelGroups.reduce((sum, group) => sum + group._count._all, 0);
        const succeeded = channelGroups.find((group) => group.status === "succeeded")?._count._all || 0;
        const weightedLatency = channelGroups.reduce(
          (sum, group) => sum + (group._avg.latencyMs || 0) * group._count._all,
          0,
        );
        return {
          channelId: channel.id,
          label: channel.label,
          provider: channel.provider.code,
          modelKind: channel.model.kind,
          modelId: channel.modelId,
          total,
          succeeded,
          failed: total - succeeded,
          successRate: total ? succeeded / total : null,
          averageLatencyMs: total ? Math.round(weightedLatency / total) : null,
        };
      }),
    };
  }

  private take(raw?: string) {
    return Math.min(200, Math.max(1, Number(raw) || 50));
  }
}
