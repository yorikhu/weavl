import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { newId } from "../../common/id";
import { PrismaService } from "../../infrastructure/database/prisma.service";
import type { ProviderProtocol } from "./provider.types";

/** 创建或更新模型服务商所需的可公开配置。 */
export interface ProviderConfigInput {
  code: string;
  label: string;
  apiKeyEnv: string;
  enabled?: boolean;
  metadata?: Record<string, unknown>;
  pricingAdapter?: string | null;
  pricingUrl?: string | null;
}

/** 创建或更新平台模型定义所需的配置。 */
export interface ModelConfigInput {
  id: string;
  kind: "text" | "image" | "video" | "audio" | "avatar";
  label: string;
  maker: string;
  description: string;
  isAuto?: boolean;
  enabled?: boolean;
  capabilities?: Record<string, unknown>;
}

/** 创建或更新供应渠道所需的连接与路由配置。 */
export interface ChannelConfigInput {
  providerId: string;
  modelId: string;
  protocol: ProviderProtocol;
  remoteModel: string;
  label: string;
  baseUrl: string;
  capabilities?: Record<string, unknown>;
  weight?: number;
  priority?: number;
  enabled?: boolean;
  failureThreshold?: number;
  cooldownSeconds?: number;
}

/** 管理数据库中的模型、服务商和供应渠道配置。 */
@Injectable()
export class IntegrationConfigService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 查询所有服务商。
   *
   * @returns 服务商列表、关联渠道数量及密钥是否已在进程环境中配置。
   */
  async listProviders() {
    const providers = await this.prisma.modelProvider.findMany({
      include: { _count: { select: { channels: true } } },
      orderBy: [{ enabled: "desc" }, { label: "asc" }],
    });
    return providers.map(({ _count, ...provider }) => ({
      ...provider,
      configured: Boolean(process.env[provider.apiKeyEnv]),
      channelCount: _count.channels,
    }));
  }

  /**
   * 创建一个服务商配置；密钥字段只保存环境变量名称。
   *
   * @param input - 服务商代码、展示名称和密钥引用。
   * @returns 新建的服务商配置。
   */
  async createProvider(input: ProviderConfigInput) {
    if (await this.prisma.modelProvider.findUnique({ where: { code: input.code }, select: { id: true } }))
      throw new ConflictException("服务商代码已存在");
    return this.prisma.modelProvider.create({
      data: {
        id: newId("provider"),
        ...input,
        metadata: (input.metadata || {}) as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * 更新服务商名称、密钥引用、启用状态或扩展元数据。
   *
   * @param id - 服务商标识。
   * @param input - 要更新的字段。
   * @returns 更新后的服务商配置。
   */
  async updateProvider(id: string, input: Partial<ProviderConfigInput>) {
    await this.assertProvider(id);
    if (
      input.code &&
      (await this.prisma.modelProvider.findFirst({
        where: { code: input.code, id: { not: id } },
        select: { id: true },
      }))
    )
      throw new ConflictException("服务商代码已存在");
    return this.prisma.modelProvider.update({
      where: { id },
      data: {
        ...input,
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * 删除未被渠道引用的服务商。
   *
   * @param id - 服务商标识。
   * @returns 删除结果。
   */
  async removeProvider(id: string) {
    await this.assertProvider(id);
    if (await this.prisma.providerChannel.count({ where: { providerId: id } }))
      throw new BadRequestException("服务商仍有渠道，请先删除或迁移渠道");
    await this.prisma.modelProvider.delete({ where: { id } });
    return { ok: true };
  }

  /**
   * 查询全部平台模型。
   *
   * @returns 全部模型定义及其渠道数量。
   */
  async listModels() {
    const models = await this.prisma.modelDefinition.findMany({
      include: { _count: { select: { channels: true } } },
      orderBy: [{ kind: "asc" }, { isAuto: "desc" }, { label: "asc" }],
    });
    return models.map(({ _count, ...model }) => ({
      ...model,
      channelCount: _count.channels,
    }));
  }

  /**
   * 创建平台稳定模型；供应商实际模型名由渠道单独维护。
   *
   * @param input - 模型标识、类型和展示能力配置。
   * @returns 新建的模型定义。
   */
  async createModel(input: ModelConfigInput) {
    if (await this.prisma.modelDefinition.findUnique({ where: { id: input.id }, select: { id: true } }))
      throw new ConflictException("模型标识已存在");
    await this.assertAutoModelAvailable(input.kind, input.isAuto);
    return this.prisma.modelDefinition.create({
      data: {
        ...input,
        capabilities: (input.capabilities || {}) as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * 更新模型展示信息、能力参数与启用状态。
   *
   * @param id - 平台模型标识。
   * @param input - 要更新的模型字段。
   * @returns 更新后的模型定义。
   */
  async updateModel(id: string, input: Partial<Omit<ModelConfigInput, "id">>) {
    const current = await this.assertModel(id);
    await this.assertAutoModelAvailable(input.kind || current.kind, input.isAuto, id);
    return this.prisma.modelDefinition.update({
      where: { id },
      data: {
        ...input,
        capabilities: input.capabilities as Prisma.InputJsonValue | undefined,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * 删除未被渠道引用的模型定义。
   *
   * @param id - 平台模型标识。
   * @returns 删除结果。
   */
  async removeModel(id: string) {
    await this.assertModel(id);
    if (await this.prisma.providerChannel.count({ where: { modelId: id } }))
      throw new BadRequestException("模型仍有渠道，请先删除或迁移渠道");
    if (await this.prisma.generationUsage.count({ where: { modelId: id } }))
      throw new BadRequestException("模型已有计费用量记录，只能停用，不能删除");
    await this.prisma.modelDefinition.delete({ where: { id } });
    return { ok: true };
  }

  /**
   * 查询全部供应渠道。
   *
   * @returns 包含模型和服务商摘要的全部路由渠道。
   */
  listChannels() {
    return this.prisma.providerChannel.findMany({
      include: {
        provider: { select: { id: true, code: true, label: true, enabled: true, apiKeyEnv: true } },
        model: { select: { id: true, kind: true, label: true, enabled: true } },
      },
      orderBy: [{ model: { kind: "asc" } }, { modelId: "asc" }, { weight: "desc" }, { priority: "asc" }],
    });
  }

  /**
   * 创建连接某个服务商与平台模型的调用渠道。
   *
   * @param input - 渠道连接、协议和路由参数。
   * @returns 新建的渠道。
   */
  async createChannel(input: ChannelConfigInput) {
    const [, model] = await Promise.all([this.assertProvider(input.providerId), this.assertModel(input.modelId)]);
    if (model.isAuto) throw new BadRequestException("自动路由模型不能直接绑定供应渠道");
    return this.prisma.providerChannel.create({
      data: {
        id: newId("channel"),
        ...input,
        capabilities: (input.capabilities || {}) as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * 更新渠道端点、远端模型名、协议和故障切换参数。
   *
   * @param id - 渠道标识。
   * @param input - 要更新的渠道字段。
   * @returns 更新后的渠道。
   */
  async updateChannel(id: string, input: Partial<ChannelConfigInput>) {
    await this.assertChannel(id);
    const [, model] = await Promise.all([
      input.providerId ? this.assertProvider(input.providerId) : Promise.resolve(),
      input.modelId ? this.assertModel(input.modelId) : Promise.resolve(),
    ]);
    if (model?.isAuto) throw new BadRequestException("自动路由模型不能直接绑定供应渠道");
    return this.prisma.providerChannel.update({
      where: { id },
      data: {
        ...input,
        capabilities: input.capabilities as Prisma.InputJsonValue | undefined,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * 删除渠道；历史调用日志由数据库级联删除。
   *
   * @param id - 渠道标识。
   * @returns 删除结果。
   */
  async removeChannel(id: string) {
    await this.assertChannel(id);
    await this.prisma.providerChannel.delete({ where: { id } });
    return { ok: true };
  }

  /** 校验服务商存在并返回其最小身份信息。 */
  private async assertProvider(id: string) {
    if (!(await this.prisma.modelProvider.findUnique({ where: { id }, select: { id: true } })))
      throw new NotFoundException("服务商不存在");
  }

  /** 校验模型存在并返回路由校验需要的字段。 */
  private async assertModel(id: string) {
    const model = await this.prisma.modelDefinition.findUnique({
      where: { id },
      select: { id: true, kind: true, isAuto: true },
    });
    if (!model) throw new NotFoundException("模型不存在");
    return model;
  }

  /** 校验渠道存在。 */
  private async assertChannel(id: string) {
    if (!(await this.prisma.providerChannel.findUnique({ where: { id }, select: { id: true } })))
      throw new NotFoundException("渠道不存在");
  }

  /** 保证每种模态最多只有一个自动路由模型。 */
  private async assertAutoModelAvailable(kind: string, isAuto?: boolean, excludeId?: string) {
    if (!isAuto) return;
    const existing = await this.prisma.modelDefinition.findFirst({
      where: { kind, isAuto: true, id: excludeId ? { not: excludeId } : undefined },
      select: { id: true },
    });
    if (existing) throw new ConflictException("每种模型类型只能配置一个自动路由入口");
  }
}
