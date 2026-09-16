import { Injectable, OnModuleInit } from "@nestjs/common";
import { newId } from "../../common/id";
import type { ProviderChannel as DatabaseChannel } from "@prisma/client";
import { PrismaService } from "../../infrastructure/database/prisma.service";
import type { ProviderChannel } from "./provider.types";
type ChannelConfig = Omit<ProviderChannel, "id" | "enabled" | "failureThreshold" | "cooldownSeconds"> &
  Partial<Pick<ProviderChannel, "id" | "enabled" | "failureThreshold" | "cooldownSeconds">>;
@Injectable()
export class ProviderRegistryService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}
  async onModuleInit() {
    for (const channel of this.configuredChannels()) await this.upsert(channel);
  }
  async candidates(kind: ProviderChannel["modelKind"], modelId: string) {
    const rows = await this.prisma.providerChannel.findMany({
      where: { modelKind: kind, modelId: modelId === "weavl-text" ? undefined : modelId, enabled: true },
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
  async list() {
    return (
      await this.prisma.providerChannel.findMany({
        orderBy: [{ modelKind: "asc" }, { modelId: "asc" }, { priority: "asc" }],
      })
    ).map((x) => this.map(x));
  }
  private async upsert(x: ChannelConfig) {
    const id = x.id || newId("channel");
    const data = {
      provider: x.provider,
      modelKind: x.modelKind,
      modelId: x.modelId,
      remoteModel: x.remoteModel,
      label: x.label,
      baseUrl: x.baseUrl,
      apiKeyEnv: x.apiKeyEnv,
      priority: x.priority,
      enabled: x.enabled ?? true,
      failureThreshold: x.failureThreshold ?? 3,
      cooldownSeconds: x.cooldownSeconds ?? 60,
    };
    await this.prisma.providerChannel.upsert({ where: { id }, create: { id, ...data }, update: data });
  }
  private configuredChannels(): ChannelConfig[] {
    const channels: ChannelConfig[] = [];
    const legacy = [
      {
        provider: "volcengine",
        label: "豆包",
        base: "VOLCENGINE_BASE_URL",
        key: "VOLCENGINE_API_KEY",
        model: "VOLCENGINE_TEXT_MODEL",
        modelId: "volcengine-text",
      },
      {
        provider: "aliyun",
        label: "通义千问",
        base: "ALIYUN_BASE_URL",
        key: "ALIYUN_API_KEY",
        model: "ALIYUN_TEXT_MODEL",
        modelId: "aliyun-text",
      },
      {
        provider: "zenmux",
        label: "ZenMux Text",
        base: "ZENMUX_BASE_URL",
        key: "ZENMUX_API_KEY",
        model: "ZENMUX_TEXT_MODEL",
        modelId: "zenmux-text",
      },
    ];
    for (const [index, item] of legacy.entries()) {
      const baseUrl = process.env[item.base],
        remoteModel = process.env[item.model];
      if (baseUrl && remoteModel)
        channels.push({
          id: `channel.${item.provider}.text.default`,
          provider: item.provider,
          modelKind: "text",
          modelId: item.modelId,
          remoteModel,
          label: item.label,
          baseUrl,
          apiKeyEnv: item.key,
          priority: (index + 1) * 10,
        });
    }
    if (process.env.WEAVL_MODEL_CHANNELS_JSON)
      channels.push(...(JSON.parse(process.env.WEAVL_MODEL_CHANNELS_JSON) as ChannelConfig[]));
    return channels;
  }
  private map(x: DatabaseChannel): ProviderChannel {
    return {
      id: x.id,
      provider: x.provider,
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
