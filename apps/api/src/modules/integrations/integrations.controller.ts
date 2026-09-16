import { Controller, Get, Query, Req, UseGuards } from "@nestjs/common";
import { AuthRequest } from "../../common/http";
import { PrismaService } from "../../infrastructure/database/prisma.service";
import { SessionGuard } from "../auth/session.guard";
import { ProviderRegistryService } from "./provider-registry.service";
@Controller("studio/integrations")
@UseGuards(SessionGuard)
export class IntegrationsController {
  constructor(
    private readonly registry: ProviderRegistryService,
    private readonly prisma: PrismaService,
  ) {}
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
  @Get("history") history(@Query("channelId") channelId?: string) {
    return this.prisma.providerRequestLog.findMany({
      where: { channelId },
      include: { channel: { select: { label: true, provider: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

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
