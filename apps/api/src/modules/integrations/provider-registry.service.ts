import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../../infrastructure/database/prisma.service";
import type { GenerationModel, ProviderChannel, ProviderProtocol } from "./provider.types";

type DatabaseChannel = Prisma.ProviderChannelGetPayload<{ include: { provider: true; model: true } }>;

/** 首批模型的产品展示顺序；未列出的新模型保持数据库原顺序并排列在后。 */
const MODEL_DISPLAY_ORDER = new Map([["gpt-image-2", 0]]);

type GenerationParameters = Record<string, unknown>;

/** 将中英文画质值归一化为渠道匹配使用的稳定枚举。 */
function normalizedQuality(value: string) {
  const aliases: Record<string, string> = {
    低画质: "low",
    标准画质: "medium",
    高画质: "high",
  };
  return aliases[value] || value.toLowerCase();
}

/** 从未知渠道能力中读取字符串数组。 */
function stringOptions(capabilities: Record<string, unknown>, key: string) {
  const value = capabilities[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

/** 从未知渠道能力中读取有限数值数组。 */
function numberOptions(capabilities: Record<string, unknown>, key: string) {
  const value = capabilities[key];
  return Array.isArray(value)
    ? value.filter((item): item is number => typeof item === "number" && Number.isFinite(item))
    : [];
}

/** 判断一条渠道是否完整支持本次媒体生成参数。未声明的能力字段视为不限制。 */
export function channelSupports(capabilities: Record<string, unknown>, request: GenerationParameters) {
  const hasReferenceImages = Array.isArray(request.referenceImages) && request.referenceImages.length > 0;
  if (hasReferenceImages && capabilities.referenceImages === false) return false;
  if (!hasReferenceImages && capabilities.referenceOnly === true) return false;
  const dimensions = Array.isArray(capabilities.dimensions)
    ? capabilities.dimensions.filter((item): item is { ratio: string; width: number; height: number } =>
        Boolean(
          item &&
          typeof item === "object" &&
          typeof (item as { ratio?: unknown }).ratio === "string" &&
          typeof (item as { width?: unknown }).width === "number" &&
          typeof (item as { height?: unknown }).height === "number",
        ),
      )
    : [];
  if (typeof request.ratio === "string" && dimensions.length) {
    if (!dimensions.some((item) => item.ratio === request.ratio)) return false;
  }
  const resolutions = stringOptions(capabilities, "resolutions").map((item) => item.toLowerCase());
  if (typeof request.resolution === "string" && resolutions.length) {
    if (!resolutions.includes(request.resolution.toLowerCase())) return false;
  }
  const qualities = stringOptions(capabilities, "qualities").map(normalizedQuality);
  if (typeof request.quality === "string" && qualities.length) {
    if (!qualities.includes(normalizedQuality(request.quality))) return false;
  }
  const durations = numberOptions(capabilities, "durations");
  if (typeof request.durationSeconds === "number" && durations.length) {
    const minimum = Math.min(...durations);
    const maximum = Math.max(...durations);
    if (request.durationSeconds < minimum || request.durationSeconds > maximum) return false;
  }
  const counts = numberOptions(capabilities, "counts");
  if (typeof request.count === "number" && counts.length && !counts.includes(request.count)) return false;
  if (request.generateAudio === true && capabilities.generateAudio === false) return false;
  return true;
}

/** 合并多条上架渠道的能力，用于客户端模型参数面板展示。 */
export function mergeChannelCapabilities(fallback: Record<string, unknown>, profiles: Record<string, unknown>[]) {
  const configured = profiles.filter((profile) => Object.keys(profile).length > 0);
  if (!configured.length) return fallback;
  const mergeStrings = (key: string) => [...new Set(configured.flatMap((profile) => stringOptions(profile, key)))];
  const mergeNumbers = (key: string) =>
    [...new Set(configured.flatMap((profile) => numberOptions(profile, key)))].sort((left, right) => left - right);
  const dimensions = new Map<string, { ratio: string; width: number; height: number }>();
  for (const profile of configured) {
    const values = Array.isArray(profile.dimensions) ? profile.dimensions : [];
    for (const value of values) {
      if (!value || typeof value !== "object") continue;
      const item = value as { ratio?: unknown; width?: unknown; height?: unknown };
      if (typeof item.ratio !== "string" || typeof item.width !== "number" || typeof item.height !== "number") continue;
      if (dimensions.has(item.ratio)) continue;
      dimensions.set(item.ratio, {
        ratio: item.ratio,
        width: item.width,
        height: item.height,
      });
    }
  }
  return {
    verified: configured.every((profile) => profile.verified === true),
    dimensions: [...dimensions.values()],
    qualities: mergeStrings("qualities"),
    resolutions: mergeStrings("resolutions"),
    durations: mergeNumbers("durations"),
    counts: mergeNumbers("counts"),
    generateAudio: configured.some((profile) => profile.generateAudio === true),
  };
}

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
   * @param parameters - 本次标准化生成参数，用于剔除不支持该规格的渠道。
   * @returns 按权重、优先级排列且支持请求参数的健康渠道。
   */
  async candidates(kind: ProviderChannel["modelKind"], modelId: string, parameters: GenerationParameters = {}) {
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
      orderBy: [{ weight: "desc" }, { priority: "asc" }, { id: "asc" }],
    });

    return rows
      .filter((row) => {
        const window = row.requestLogs.slice(0, row.failureThreshold);
        const failed = window.length >= row.failureThreshold && window.every((log) => log.status === "failed");
        const latest = window[0]?.createdAt;
        return !failed || !latest || Date.now() - latest.getTime() > row.cooldownSeconds * 1000;
      })
      .filter((row) => channelSupports(this.channelCapabilities(row), parameters))
      .map((row) => this.map(row));
  }

  /** @returns 数据库中的全部渠道及其服务商、模型信息。 */
  async list() {
    return (
      await this.prisma.providerChannel.findMany({
        include: { provider: true, model: true },
        orderBy: [{ model: { kind: "asc" } }, { modelId: "asc" }, { weight: "desc" }, { priority: "asc" }],
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
      where: { enabled: true, kind, isAuto: false },
      include: { channels: { where: { enabled: true }, include: { provider: true } } },
      orderBy: [{ createdAt: "asc" }],
    });
    return models
      .map((model) => ({
        id: model.id,
        kind: model.kind as ProviderChannel["modelKind"],
        label: model.label,
        maker: model.maker,
        description: model.description,
        isAuto: model.isAuto,
        enabled: model.enabled,
        capabilities: mergeChannelCapabilities(
          this.objectValue(model.capabilities),
          model.channels
            .filter((channel) => channel.provider.enabled)
            .map((channel) => {
              const channelCapabilities = this.objectValue(channel.capabilities);
              return Object.keys(channelCapabilities).length
                ? channelCapabilities
                : this.objectValue(model.capabilities);
            }),
        ),
        configured: model.channels.some(
          (channel) => channel.provider.enabled && Boolean(process.env[channel.provider.apiKeyEnv]),
        ),
      }))
      .sort((left, right) => {
        const leftOrder = MODEL_DISPLAY_ORDER.get(left.id) ?? Number.MAX_SAFE_INTEGER;
        const rightOrder = MODEL_DISPLAY_ORDER.get(right.id) ?? Number.MAX_SAFE_INTEGER;
        return leftOrder - rightOrder;
      });
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
      capabilities: this.channelCapabilities(row),
      weight: row.weight,
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

  /** 返回渠道自己的能力配置；旧渠道未配置时继承所属模型的默认能力。 */
  private channelCapabilities(row: Pick<DatabaseChannel, "capabilities" | "model">) {
    const capabilities = this.objectValue(row.capabilities);
    return Object.keys(capabilities).length ? capabilities : this.objectValue(row.model.capabilities);
  }
}
