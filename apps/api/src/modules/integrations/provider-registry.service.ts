import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../../infrastructure/database/prisma.service";
import type { GenerationModel, ProviderChannel, ProviderProtocol } from "./provider.types";

type DatabaseChannel = Prisma.ProviderChannelGetPayload<{ include: { provider: true; model: true } }>;

/**
 * 运行时供应渠道注册表。
 * 模型、服务商与渠道全部以 PostgreSQL 为准，本服务不会在启动时用环境变量覆盖配置。
 */
@Injectable()
export class ProviderRegistryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 返回指定生成类型和逻辑模型的健康渠道。
   * 自动模型会匹配同类型的所有普通模型，连续失败的渠道在冷却期内被排除。
   *
   * @param kind - 要调用的模型类型。
   * @param modelId - 数据库中的模型标识。
   * @returns 按优先级排列的健康渠道。
   */
  async candidates(kind: ProviderChannel["modelKind"], modelId: string) {
    const requestedModel = await this.prisma.modelDefinition.findUnique({ where: { id: modelId } });
    if (!requestedModel || !requestedModel.enabled || requestedModel.kind !== kind) return [];

    const rows = await this.prisma.providerChannel.findMany({
      where: {
        enabled: true,
        provider: { enabled: true },
        model: { enabled: true, kind, isAuto: false },
        modelId: requestedModel.isAuto ? undefined : modelId,
      },
      include: {
        provider: true,
        model: true,
        requestLogs: { orderBy: { createdAt: "desc" }, take: 10 },
      },
      orderBy: [{ priority: "asc" }, { id: "asc" }],
    });

    return rows
      .filter((row) => {
        const window = row.requestLogs.slice(0, row.failureThreshold);
        const failed = window.length >= row.failureThreshold && window.every((log) => log.status === "failed");
        const latest = window[0]?.createdAt;
        return !failed || !latest || Date.now() - latest.getTime() > row.cooldownSeconds * 1000;
      })
      .map((row) => this.map(row));
  }

  /** @returns 数据库中的全部渠道及其服务商、模型信息。 */
  async list() {
    return (
      await this.prisma.providerChannel.findMany({
        include: { provider: true, model: true },
        orderBy: [{ model: { kind: "asc" } }, { modelId: "asc" }, { priority: "asc" }],
      })
    ).map((row) => this.map(row));
  }

  /**
   * 按稳定渠道 ID 查找渠道，供异步任务继续使用原供应商。
   *
   * @param id - 渠道标识。
   * @returns 对应渠道；不存在时返回 `null`。
   */
  async getChannel(id: string) {
    const channel = await this.prisma.providerChannel.findUnique({
      where: { id },
      include: { provider: true, model: true },
    });
    return channel ? this.map(channel) : null;
  }

  /**
   * 返回客户端模型目录，并根据启用渠道和密钥状态标记可用性。
   *
   * @param kind - 可选模型类型过滤条件。
   * @returns 数据库维护的模型目录。
   */
  async models(kind?: ProviderChannel["modelKind"]): Promise<Array<GenerationModel & { configured: boolean }>> {
    const models = await this.prisma.modelDefinition.findMany({
      where: { enabled: true, kind },
      include: { channels: { where: { enabled: true }, include: { provider: true } } },
      orderBy: [{ isAuto: "desc" }, { createdAt: "asc" }],
    });
    const allChannels = models.flatMap((model) => model.channels);
    return models.map((model) => ({
      id: model.id,
      kind: model.kind as ProviderChannel["modelKind"],
      label: model.label,
      maker: model.maker,
      description: model.description,
      isAuto: model.isAuto,
      enabled: model.enabled,
      capabilities: this.objectValue(model.capabilities),
      configured: model.isAuto
        ? allChannels.some((channel) => channel.provider.enabled && Boolean(process.env[channel.provider.apiKeyEnv]))
        : model.channels.some(
            (channel) => channel.provider.enabled && Boolean(process.env[channel.provider.apiKeyEnv]),
          ),
    }));
  }

  /** 将 Prisma 渠道记录转换为不依赖 ORM 的运行时对象。 */
  private map(row: DatabaseChannel): ProviderChannel {
    return {
      id: row.id,
      providerId: row.providerId,
      provider: row.provider.code,
      protocol: row.protocol as ProviderProtocol,
      modelKind: row.model.kind as ProviderChannel["modelKind"],
      modelId: row.modelId,
      remoteModel: row.remoteModel,
      label: row.label,
      baseUrl: row.baseUrl,
      apiKeyEnv: row.provider.apiKeyEnv,
      priority: row.priority,
      enabled: row.enabled && row.provider.enabled && row.model.enabled,
      failureThreshold: row.failureThreshold,
      cooldownSeconds: row.cooldownSeconds,
    };
  }

  /** 将 Prisma JSON 值收敛为模型能力对象。 */
  private objectValue(value: Prisma.JsonValue): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  }
}
