import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { GenerationJob, Prisma } from "@prisma/client";
import { newId } from "../../common/id";
import { PrismaService } from "../../infrastructure/database/prisma.service";
import { AssetsService } from "../assets/assets.service";
import { PricingService } from "../billing/pricing.service";
import { ModelGatewayService } from "../integrations/model-gateway.service";
import { ProviderRegistryService } from "../integrations/provider-registry.service";
import type { ImageGenerationRequest } from "../integrations/provider.types";
import { GenerationTaskQueue } from "./generation-task.queue";

type ImageGenerationInput = ImageGenerationRequest & { referenceAssetIds?: string[] };

/** 编排图片任务入队、Worker 执行、状态恢复、资产固化和积分结算。 */
@Injectable()
export class ImageGenerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assets: AssetsService,
    private readonly pricing: PricingService,
    private readonly gateway: ModelGatewayService,
    private readonly registry: ProviderRegistryService,
    private readonly queue: GenerationTaskQueue,
  ) {}

  /**
   * 创建图片生成任务、预扣积分并写入 BullMQ，HTTP 请求无需等待供应商完成。
   *
   * @param ownerId - 当前用户 ID。
   * @param modelId - 图片模型标识。
   * @param request - 标准化图片生成参数和参考资产。
   * @returns 已进入队列的数据库任务和计费信息。
   */
  async submit(ownerId: string, modelId: string, request: ImageGenerationInput) {
    await this.assertModel(modelId);
    const { referenceAssetIds = [], ...providerRequest } = request;
    if (referenceAssetIds.length) await this.assets.readImageInputs(referenceAssetIds, ownerId);
    const billing = await this.pricing.reserve(ownerId, modelId, providerRequest as unknown as Record<string, unknown>);
    let job: GenerationJob | null = null;
    try {
      job = await this.prisma.generationJob.create({
        data: {
          id: newId("generation"),
          ownerId,
          modelKind: "image",
          modelId,
          status: "queued",
          request: { ...providerRequest, referenceAssetIds } as unknown as Prisma.InputJsonValue,
        },
      });
      await this.pricing.attach(billing.usageId, { jobId: job.id });
      await this.queue.enqueue({ jobId: job.id, kind: "image", ownerId });
      return { ...this.jobView(job), billing };
    } catch (error) {
      const message = (error as Error).message || "图片任务入队失败";
      if (job)
        await this.prisma.generationJob.update({
          where: { id: job.id },
          data: { status: "failed", errorMessage: message, updatedAt: new Date() },
        });
      await this.pricing.refund(billing.usageId, message);
      throw error;
    }
  }

  /**
   * 由 BullMQ Worker 执行图片生成、产物固化和积分结算。
   * 已完成任务会直接返回，保证队列重复投递时不会再次调用供应商。
   *
   * @param jobId - GenerationJob 主键。
   * @returns 完成后的任务和项目资产。
   */
  async process(jobId: string) {
    const job = await this.prisma.generationJob.findFirst({ where: { id: jobId, modelKind: "image" } });
    if (!job) throw new NotFoundException("图片生成任务不存在");
    if (job.status === "succeeded") return this.hydratedJobView(job, job.ownerId);
    if (job.status === "failed") throw new BadRequestException(job.errorMessage || "图片生成任务已失败");

    const existingAssets = await this.prisma.asset.findMany({
      where: { ownerId: job.ownerId, sourceId: job.id, deletedAt: null },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });
    if (existingAssets.length) {
      const recovered = await this.prisma.generationJob.update({
        where: { id: job.id },
        data: {
          status: "succeeded",
          result: { assetIds: existingAssets.map((asset) => asset.id) },
          errorMessage: null,
          updatedAt: new Date(),
        },
      });
      await this.pricing.settleForJob(job.id, job.channelId || undefined);
      return this.hydratedJobView(recovered, job.ownerId);
    }

    const request = job.request as unknown as ImageGenerationInput;
    const { referenceAssetIds = [], ...providerRequest } = request;
    const referenceImages = await this.assets.readImageInputs(referenceAssetIds, job.ownerId);
    const generationRequest: ImageGenerationRequest = {
      ...providerRequest,
      ...(referenceImages.length ? { referenceImages } : {}),
    };
    await this.prisma.generationJob.update({
      where: { id: job.id },
      data: { status: "running", errorMessage: null, updatedAt: new Date() },
    });
    const result = await this.gateway.generateImage(job.modelId, generationRequest);
    await this.prisma.generationJob.update({
      where: { id: job.id },
      data: { channelId: result.channelId, status: "finalizing", updatedAt: new Date() },
    });
    const assets = await Promise.all(
      result.outputs.map((output, index) =>
        this.assets.create({
          ownerId: job.ownerId,
          name: `图片 ${new Date().toLocaleDateString("zh-CN")} ${index + 1}`,
          kind: "image",
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
        channelId: result.channelId,
        status: "succeeded",
        result: { assetIds: assets.map((asset) => asset.id) },
        errorMessage: null,
        updatedAt: new Date(),
      },
    });
    await this.pricing.settleForJob(job.id, result.channelId);
    return { ...this.jobView(succeeded), assets };
  }

  /**
   * 记录队列重试或最终失败；只有最后一次失败才退款。
   *
   * @param jobId - GenerationJob 主键。
   * @param message - 本次失败原因。
   * @param finalAttempt - 是否已耗尽 BullMQ 重试次数。
   */
  async recordAttemptFailure(jobId: string, message: string, finalAttempt: boolean) {
    const status = finalAttempt ? "failed" : "queued";
    await this.prisma.generationJob.updateMany({
      where: { id: jobId, modelKind: "image", status: { not: "succeeded" } },
      data: { status, errorMessage: message, updatedAt: new Date() },
    });
    if (finalAttempt) await this.pricing.refundForJob(jobId, message);
  }

  /** 返回需要在 Worker 启动时恢复进队列的图片任务。 */
  async pendingJobs() {
    const jobs = await this.prisma.generationJob.findMany({
      where: { modelKind: "image", status: { in: ["queued", "running", "finalizing"] } },
      select: { id: true, ownerId: true },
    });
    return jobs;
  }

  /**
   * 查询当前用户的图片任务；任务完成后返回可直接展示的资产地址。
   *
   * @param ownerId - 当前用户 ID。
   * @param jobId - GenerationJob 主键。
   */
  async poll(ownerId: string, jobId: string) {
    const job = await this.prisma.generationJob.findFirst({ where: { id: jobId, ownerId, modelKind: "image" } });
    if (!job) throw new NotFoundException("图片生成任务不存在");
    return job.status === "succeeded" ? this.hydratedJobView(job, ownerId) : this.jobView(job);
  }

  /** 验证逻辑模型存在且属于图片类型。 */
  private async assertModel(modelId: string) {
    const models = await this.registry.models("image");
    if (!models.some((model) => model.id === modelId)) throw new BadRequestException("模型不存在或类型不匹配");
  }

  /** 将数据库任务转换为稳定 API 响应。 */
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

  /** 为成功任务解析 MinIO 访问地址并附加有序资产。 */
  private async hydratedJobView(job: GenerationJob, ownerId: string) {
    const result = job.result as { assetIds?: string[] } | null;
    const assets = await this.assets.getManyOwned(result?.assetIds || [], ownerId);
    return { ...this.jobView(job), assets };
  }
}
