import { Controller, Get, Query, Req, UseGuards } from "@nestjs/common";
import { AuthRequest } from "../../common/http";
import { PrismaService } from "../../infrastructure/database/prisma.service";
import { SessionGuard } from "../auth/session.guard";
import { ProviderRegistryService } from "./provider-registry.service";

/** 提供供应渠道状态、调用历史和聚合指标的内部管理接口。 */
@Controller("studio/integrations")
@UseGuards(SessionGuard)
export class IntegrationsController {
  constructor(
    private readonly registry: ProviderRegistryService,
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
   * 查询最近 200 条调用记录，可按渠道过滤。
   *
   * @param channelId - 可选供应渠道 ID。
   * @returns 按时间倒序排列的调用历史。
   */
  @Get("history") history(@Query("channelId") channelId?: string) {
    return this.prisma.providerRequestLog.findMany({
      where: { channelId },
      include: { channel: { select: { label: true, provider: true } } },
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
      this.prisma.providerChannel.findMany({ orderBy: [{ modelKind: "asc" }, { modelId: "asc" }] }),
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
          provider: channel.provider,
          modelKind: channel.modelKind,
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
}
