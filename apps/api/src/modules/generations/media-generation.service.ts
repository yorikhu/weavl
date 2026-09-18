import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { GenerationJob, Prisma } from "@prisma/client";
import { newId } from "../../common/id";
import { PrismaService } from "../../infrastructure/database/prisma.service";
import { AssetsService } from "../assets/assets.service";
import { PricingService } from "../billing/pricing.service";
import { ModelGatewayService } from "../integrations/model-gateway.service";
import { ProviderRegistryService } from "../integrations/provider-registry.service";
import type { ProviderChannel, VideoGenerationRequest } from "../integrations/provider.types";

/**
 * 媒体模型目录与视频生成业务编排层。
 * 图片队列任务由 ImageGenerationService 单独维护。
 */
@Injectable()
export class MediaGenerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assets: AssetsService,
    private readonly pricing: PricingService,
    private readonly gateway: ModelGatewayService,
    private readonly registry: ProviderRegistryService,
  ) {}

  /**
   * 返回可用的生成模型目录，可按媒体类型过滤。
   *
   * @param kind - 可选模型类型过滤条件。
   * @returns 带渠道配置状态的模型列表。
   */
  models(kind?: ProviderChannel["modelKind"]) {
    return this.registry.models(kind);
  }

  /**
   * 提交视频长任务并保存供应商任务标识，供后续轮询恢复。
   *
   * @param ownerId - 当前用户 ID。
   * @param modelId - 视频模型或自动路由标识。
   * @param request - 标准化视频生成参数。
   * @returns 已持久化的视频任务视图。
   * @throws {BadRequestException} 模型不存在或类型不匹配时抛出。
   */
  async submitVideo(ownerId: string, modelId: string, request: VideoGenerationRequest) {
    await this.assertModel("video", modelId);
    const billing = await this.pricing.reserve(ownerId, modelId, request as unknown as Record<string, unknown>);
    try {
      const result = await this.gateway.submitVideo(modelId, request);
      const job = await this.prisma.generationJob.create({
        data: {
          id: newId("generation"),
          ownerId,
          channelId: result.channelId,
          modelKind: "video",
          modelId,
          remoteOperation: result.operationName,
          status: "running",
          request: request as unknown as Prisma.InputJsonValue,
        },
      });
      await this.pricing.attach(billing.usageId, { channelId: result.channelId, jobId: job.id });
      return { ...this.jobView(job), billing };
    } catch (error) {
      await this.pricing.refund(billing.usageId, (error as Error).message || "视频任务提交失败");
      throw error;
    }
  }

  /**
   * 查询并推进视频任务状态。
   * finalizing 状态和条件更新用于防止并发轮询重复创建资产。
   *
   * @param ownerId - 当前用户 ID，用于任务和资产权限校验。
   * @param jobId - 平台视频生成任务 ID。
   * @returns 当前任务视图；完成后附带已解析的项目资产。
   * @throws {NotFoundException} 任务不存在或不属于当前用户时抛出。
   * @throws {BadRequestException} 任务缺少继续轮询所需的渠道信息时抛出。
   */
  async pollVideo(ownerId: string, jobId: string) {
    const job = await this.prisma.generationJob.findFirst({ where: { id: jobId, ownerId, modelKind: "video" } });
    if (!job) throw new NotFoundException("视频生成任务不存在");
    if (job.status === "succeeded") return this.hydratedJobView(job, ownerId);
    if (job.status === "failed") return this.jobView(job);
    if (!job.channelId || !job.remoteOperation) throw new BadRequestException("视频生成任务缺少渠道信息");

    const operation = await this.gateway.pollVideo(job.channelId, job.remoteOperation);
    if (!operation.done) return this.jobView(job);
    if (operation.error) {
      const failed = await this.prisma.generationJob.update({
        where: { id: job.id },
        data: { status: "failed", errorMessage: operation.error, updatedAt: new Date() },
      });
      await this.pricing.refundForJob(job.id, operation.error);
      return this.jobView(failed);
    }

    const claim = await this.prisma.generationJob.updateMany({
      where: { id: job.id, status: { in: ["queued", "running"] } },
      data: { status: "finalizing", updatedAt: new Date() },
    });
    if (!claim.count) {
      const current = await this.prisma.generationJob.findUniqueOrThrow({ where: { id: job.id } });
      return current.status === "succeeded" ? this.hydratedJobView(current, ownerId) : this.jobView(current);
    }

    try {
      const assets = await Promise.all(
        (operation.outputs || []).map((output, index) =>
          this.assets.create({
            ownerId,
            name: `视频 ${new Date().toLocaleDateString("zh-CN")} ${index + 1}`,
            kind: "video",
            content: output.content,
            mimeType: output.mimeType,
            source: "canvas",
            sourceId: job.id,
            inLibrary: false,
            copyRemote: true,
          }),
        ),
      );
      const succeeded = await this.prisma.generationJob.update({
        where: { id: job.id },
        data: {
          status: "succeeded",
          result: { assetIds: assets.map((asset) => asset.id) },
          errorMessage: null,
          updatedAt: new Date(),
        },
      });
      await this.pricing.settleForJob(job.id, job.channelId);
      return { ...this.jobView(succeeded), assets };
    } catch (error) {
      await this.prisma.generationJob.update({
        where: { id: job.id },
        data: { status: "failed", errorMessage: (error as Error).message, updatedAt: new Date() },
      });
      await this.pricing.refundForJob(job.id, (error as Error).message || "视频生成失败");
      throw error;
    }
  }

  /**
   * 阻止客户端用视频接口调用不存在或类型不匹配的模型。
   *
   * @param kind - 当前业务接口允许的模型类型。
   * @param modelId - 客户端提交的模型标识。
   * @returns 校验通过后结束的 Promise。
   * @throws {BadRequestException} 模型不存在或类型不匹配时抛出。
   */
  private async assertModel(kind: "video", modelId: string) {
    const models = await this.registry.models(kind);
    if (!models.some((model) => model.id === modelId)) throw new BadRequestException("模型不存在或类型不匹配");
  }

  /**
   * 将数据库任务转换为稳定的 API 响应，避免暴露供应商内部字段。
   *
   * @param job - Prisma 视频生成任务记录。
   * @returns 对外稳定的任务视图。
   */
  private jobView(job: GenerationJob) {
    return {
      id: job.id,
      model: job.modelId,
      status: job.status,
      result: job.result,
      error: job.errorMessage,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
    };
  }

  /**
   * 为已完成任务补充经过对象存储解析后的资产内容。
   *
   * @param job - 已完成的视频生成任务。
   * @param ownerId - 当前用户 ID。
   * @returns 附带有序资产列表的任务视图。
   */
  private async hydratedJobView(job: GenerationJob, ownerId: string) {
    const result = job.result as { assetIds?: string[] } | null;
    const assets = await this.assets.getManyOwned(result?.assetIds || [], ownerId);
    return { ...this.jobView(job), assets };
  }
}
