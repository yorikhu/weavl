import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { newId } from "../../common/id";
import type { ProviderChannel as DatabaseChannel } from "@prisma/client";
import { PrismaService } from "../../infrastructure/database/prisma.service";
import { GENERATION_MODELS, ZENMUX_MODELS, isAutoModel } from "./model-catalog";
import type { GenerationModel, ProviderChannel, ProviderProtocol } from "./provider.types";
type ChannelConfig = Omit<ProviderChannel, "id" | "enabled" | "failureThreshold" | "cooldownSeconds"> &
  Partial<Pick<ProviderChannel, "id" | "enabled" | "failureThreshold" | "cooldownSeconds">>;

/**
 * 供应渠道注册表。
 * 将环境配置同步到数据库，并根据优先级、启用状态和近期失败记录提供候选渠道。
 */
@Injectable()
export class ProviderRegistryService implements OnModuleInit {
  private readonly logger = new Logger(ProviderRegistryService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 启动时注册内置 ZenMux 渠道和环境变量中声明的扩展渠道。
   *
   * @returns 所有渠道完成同步后结束的 Promise。
   */
  async onModuleInit() {
    for (const channel of this.configuredChannels()) await this.upsert(channel);
  }

  /**
   * 返回指定生成类型和逻辑模型的健康渠道。
   * 自动模型会匹配该类型全部渠道，连续失败达到阈值的渠道在冷却期内被排除。
   *
   * @param kind - 要调用的模型类型。
   * @param modelId - 稳定模型标识或该类型的自动路由标识。
   * @returns 按优先级排序且已通过冷却检查的渠道。
   */
  async candidates(kind: ProviderChannel["modelKind"], modelId: string) {
    const rows = await this.prisma.providerChannel.findMany({
      where: { modelKind: kind, modelId: isAutoModel(kind, modelId) ? undefined : modelId, enabled: true },
      include: { requestLogs: { orderBy: { createdAt: "desc" }, take: 10 } },
      orderBy: [{ priority: "asc" }, { id: "asc" }],
    });
    return rows
      .filter((row) => {
        const window = row.requestLogs.slice(0, row.failureThreshold);
        const failed = window.length >= row.failureThreshold && window.every((x) => x.status === "failed");
        const latest = window[0]?.createdAt;
        return !failed || !latest || Date.now() - latest.getTime() > row.cooldownSeconds * 1000;
      })
      .map((x) => this.map(x));
  }

  /**
   * 返回数据库中的全部供应渠道，并转换为领域类型。
   *
   * @returns 按类型、模型和优先级排序的渠道列表。
   */
  async list() {
    return (
      await this.prisma.providerChannel.findMany({
        orderBy: [{ modelKind: "asc" }, { modelId: "asc" }, { priority: "asc" }],
      })
    ).map((x) => this.map(x));
  }

  /**
   * 按稳定渠道 ID 查找渠道，供异步任务继续使用原供应商。
   *
   * @param id - 供应渠道稳定 ID。
   * @returns 对应渠道；不存在时返回 `null`。
   */
  async getChannel(id: string) {
    const channel = await this.prisma.providerChannel.findUnique({ where: { id } });
    return channel ? this.map(channel) : null;
  }

  /**
   * 返回客户端模型目录，并标记每个模型当前是否存在已配置密钥的可用渠道。
   *
   * @param kind - 可选模型类型过滤条件。
   * @returns 包含渠道配置状态的产品模型列表。
   */
  async models(kind?: ProviderChannel["modelKind"]): Promise<Array<GenerationModel & { configured: boolean }>> {
    const channels = await this.list();
    return GENERATION_MODELS.filter((model) => !kind || model.kind === kind).map((model) => ({
      ...model,
      configured: channels.some(
        (channel) =>
          channel.modelKind === model.kind &&
          (model.isAuto || channel.modelId === model.id) &&
          channel.enabled &&
          Boolean(process.env[channel.apiKeyEnv]),
      ),
    }));
  }

  /**
   * 写入渠道身份配置。
   * 已存在渠道只刷新连接信息，保留管理员在数据库中调整的优先级和熔断配置。
   *
   * @param x - 来自内置目录或环境变量的渠道配置。
   * @returns 数据库写入完成后的 Promise。
   */
  private async upsert(x: ChannelConfig) {
    const id = x.id || newId("channel");
    const identity = {
      provider: x.provider,
      protocol: x.protocol,
      modelKind: x.modelKind,
      modelId: x.modelId,
      remoteModel: x.remoteModel,
      label: x.label,
      baseUrl: x.baseUrl,
      apiKeyEnv: x.apiKeyEnv,
    };
    const routing = {
      priority: x.priority,
      enabled: x.enabled ?? true,
      failureThreshold: x.failureThreshold ?? 3,
      cooldownSeconds: x.cooldownSeconds ?? 60,
    };
    await this.prisma.providerChannel.upsert({
      where: { id },
      create: { id, ...identity, ...routing },
      update: identity,
    });
  }

  /**
   * 汇总内置 ZenMux、兼容旧配置和 WEAVL_MODEL_CHANNELS_JSON 中的渠道。
   *
   * @returns 启动时应注册的全部渠道配置。
   */
  private configuredChannels(): ChannelConfig[] {
    const zenMuxChatBase = process.env.ZENMUX_BASE_URL || "https://zenmux.ai/api/v1";
    const zenMuxVertexBase = process.env.ZENMUX_VERTEX_BASE_URL || "https://zenmux.ai/api/vertex-ai";
    const channels: ChannelConfig[] = ZENMUX_MODELS.map((model) => ({
      id: `channel.zenmux.${model.kind}.${model.id}`,
      provider: "zenmux",
      protocol: model.protocol,
      modelKind: model.kind,
      modelId: model.id,
      remoteModel: model.remoteModel,
      label: `ZenMux · ${model.label}`,
      baseUrl: model.protocol === "openai-chat" ? zenMuxChatBase : zenMuxVertexBase,
      apiKeyEnv: "ZENMUX_API_KEY",
      priority: model.priority,
    }));
    const legacy = [
      {
        provider: "volcengine",
        label: "豆包",
        base: "VOLCENGINE_BASE_URL",
        key: "VOLCENGINE_API_KEY",
        model: "VOLCENGINE_TEXT_MODEL",
        modelId: "volcengine-text",
        protocol: "openai-chat" as ProviderProtocol,
      },
      {
        provider: "aliyun",
        label: "通义千问",
        base: "ALIYUN_BASE_URL",
        key: "ALIYUN_API_KEY",
        model: "ALIYUN_TEXT_MODEL",
        modelId: "aliyun-text",
        protocol: "openai-chat" as ProviderProtocol,
      },
    ];
    for (const [index, item] of legacy.entries()) {
      const baseUrl = process.env[item.base],
        remoteModel = process.env[item.model];
      if (baseUrl && remoteModel)
        channels.push({
          id: `channel.${item.provider}.text.default`,
          provider: item.provider,
          protocol: item.protocol,
          modelKind: "text",
          modelId: item.modelId,
          remoteModel,
          label: item.label,
          baseUrl,
          apiKeyEnv: item.key,
          priority: (index + 1) * 10,
        });
    }
    if (process.env.WEAVL_MODEL_CHANNELS_JSON) {
      try {
        const configured = JSON.parse(process.env.WEAVL_MODEL_CHANNELS_JSON) as Array<
          Omit<ChannelConfig, "protocol"> & { protocol?: ProviderProtocol }
        >;
        if (!Array.isArray(configured)) throw new Error("根值必须是数组");
        channels.push(
          ...configured.map((channel) => ({
            ...channel,
            protocol:
              channel.protocol ||
              (channel.modelKind === "image"
                ? "vertex-image"
                : channel.modelKind === "video"
                  ? "vertex-video"
                  : "openai-chat"),
          })),
        );
      } catch (error) {
        this.logger.error(`WEAVL_MODEL_CHANNELS_JSON 无法解析：${(error as Error).message}`);
      }
    }
    return channels;
  }

  /**
   * 将 Prisma 记录收敛为不依赖 ORM 的领域对象。
   *
   * @param x - Prisma 返回的渠道记录。
   * @returns 供应渠道领域对象。
   */
  private map(x: DatabaseChannel): ProviderChannel {
    return {
      id: x.id,
      provider: x.provider,
      protocol: x.protocol as ProviderProtocol,
      modelKind: x.modelKind as ProviderChannel["modelKind"],
      modelId: x.modelId,
      remoteModel: x.remoteModel,
      label: x.label,
      baseUrl: x.baseUrl,
      apiKeyEnv: x.apiKeyEnv,
      priority: x.priority,
      enabled: x.enabled,
      failureThreshold: x.failureThreshold,
      cooldownSeconds: x.cooldownSeconds,
    };
  }
}
