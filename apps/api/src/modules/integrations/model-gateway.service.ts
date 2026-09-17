import { BadGatewayException, Injectable } from "@nestjs/common";
import { newId } from "../../common/id";
import { PrismaService } from "../../infrastructure/database/prisma.service";
import { OpenAiCompatibleAdapter } from "./providers/openai-compatible.adapter";
import { OpenAiImageAdapter } from "./providers/openai-image.adapter";
import { VertexImageAdapter } from "./providers/vertex-image.adapter";
import { VertexVideoAdapter } from "./providers/vertex-video.adapter";
import { ProviderRegistryService } from "./provider-registry.service";
import type { ImageGenerationRequest, TextGenerationRequest, VideoGenerationRequest } from "./provider.types";

/**
 * 统一模型调用网关。
 * 它只处理渠道选择、协议分派、失败切换和调用日志，不承载业务资产逻辑。
 */
@Injectable()
export class ModelGatewayService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: ProviderRegistryService,
    private readonly textAdapter: OpenAiCompatibleAdapter,
    private readonly openAiImageAdapter: OpenAiImageAdapter,
    private readonly imageAdapter: VertexImageAdapter,
    private readonly videoAdapter: VertexVideoAdapter,
  ) {}

  /**
   * 依次尝试可用文本渠道，首个成功结果即作为本次生成结果。
   *
   * @param modelId - 平台稳定模型标识或文本自动路由标识。
   * @param request - 标准化文本生成参数。
   * @returns 文本内容、实际渠道、供应商和响应状态。
   * @throws {BadGatewayException} 所有候选渠道均失败或不存在可用渠道时抛出。
   */
  async generateText(modelId: string, request: TextGenerationRequest) {
    const channels = await this.registry.candidates("text", modelId, request as unknown as Record<string, unknown>);
    const errors: string[] = [];
    for (const channel of channels) {
      const started = Date.now();
      try {
        if (channel.protocol !== "openai-chat") throw new Error(`文本渠道协议不受支持：${channel.protocol}`);
        const result = await this.textAdapter.generateText(channel, request);
        await this.log(channel.id, "text", "succeeded", Date.now() - started, result.statusCode);
        return {
          ...result,
          model: modelId,
          mode: "live" as const,
          channelId: channel.id,
          provider: channel.provider,
        };
      } catch (error) {
        const message = (error as Error).message || "渠道调用失败";
        errors.push(`${channel.label}: ${message}`);
        await this.log(
          channel.id,
          "text",
          "failed",
          Date.now() - started,
          (error as { statusCode?: number }).statusCode,
          message,
        );
      }
    }
    throw new BadGatewayException(
      errors.length ? `所有可用渠道均调用失败：${errors.join("；")}` : "当前模型没有可用渠道",
    );
  }

  /**
   * 通过统一图片适配器执行生成，并在渠道失败时继续尝试下一候选项。
   *
   * @param modelId - 平台稳定模型标识或图片自动路由标识。
   * @param request - 标准化图片生成参数。
   * @returns 标准化媒体产物及实际命中的供应渠道。
   * @throws {BadGatewayException} 所有图片渠道均失败时抛出。
   */
  async generateImage(modelId: string, request: ImageGenerationRequest) {
    return this.execute("image", modelId, request as unknown as Record<string, unknown>, async (channel) => {
      if (channel.protocol === "openai-image") return this.openAiImageAdapter.generate(channel, request);
      if (channel.protocol !== "vertex-image" && channel.protocol !== "vertex-generate-content")
        throw new Error(`图片渠道协议不受支持：${channel.protocol}`);
      return this.imageAdapter.generate(channel, request);
    });
  }

  /**
   * 提交异步视频生成任务。
   *
   * @param modelId - 平台稳定模型标识或视频自动路由标识。
   * @param request - 标准化视频生成参数。
   * @returns 供应商任务标识及实际命中的渠道。
   * @throws {BadGatewayException} 所有视频渠道均失败时抛出。
   */
  async submitVideo(modelId: string, request: VideoGenerationRequest) {
    return this.execute("video", modelId, request as unknown as Record<string, unknown>, async (channel) => {
      if (channel.protocol !== "vertex-video") throw new Error(`视频渠道协议不受支持：${channel.protocol}`);
      return this.videoAdapter.submit(channel, request);
    });
  }

  /**
   * 使用任务创建时的原渠道查询视频状态，避免轮询阶段切换供应商。
   *
   * @param channelId - 创建任务时记录的供应渠道 ID。
   * @param operationName - 供应商返回的长任务标识。
   * @returns 标准化任务状态、产物或错误信息。
   * @throws {BadGatewayException} 渠道不存在、已停用或协议不匹配时抛出。
   */
  async pollVideo(channelId: string, operationName: string) {
    const channel = await this.registry.getChannel(channelId);
    if (!channel || !channel.enabled) throw new BadGatewayException("视频生成渠道已停用或不存在");
    if (channel.protocol !== "vertex-video") throw new BadGatewayException("视频生成渠道协议不匹配");
    const started = Date.now();
    try {
      const result = await this.videoAdapter.poll(channel, operationName);
      await this.log(channel.id, "video-poll", "succeeded", Date.now() - started, result.statusCode);
      return result;
    } catch (error) {
      const message = (error as Error).message || "视频任务查询失败";
      await this.log(
        channel.id,
        "video-poll",
        "failed",
        Date.now() - started,
        (error as { statusCode?: number }).statusCode,
        message,
      );
      throw error;
    }
  }

  /**
   * 执行图片或视频渠道的通用故障切换与日志记录流程。
   *
   * @template T - 适配器返回类型，必须包含 HTTP 状态码。
   * @param kind - 本次调用的媒体类型。
   * @param modelId - 平台稳定模型标识或自动路由标识。
   * @param parameters - 用于匹配渠道能力的标准化生成参数。
   * @param call - 针对单条候选渠道执行的协议调用。
   * @returns 首个成功渠道的结果和渠道元数据。
   * @throws {BadGatewayException} 所有候选渠道均失败时抛出。
   */
  private async execute<T extends { statusCode: number }>(
    kind: "image" | "video",
    modelId: string,
    parameters: Record<string, unknown>,
    call: (channel: Awaited<ReturnType<ProviderRegistryService["candidates"]>>[number]) => Promise<T>,
  ) {
    const channels = await this.registry.candidates(kind, modelId, parameters);
    const errors: string[] = [];
    for (const channel of channels) {
      const started = Date.now();
      try {
        const result = await call(channel);
        await this.log(channel.id, kind, "succeeded", Date.now() - started, result.statusCode);
        return { ...result, model: modelId, channelId: channel.id, provider: channel.provider };
      } catch (error) {
        const message = (error as Error).message || "渠道调用失败";
        errors.push(`${channel.label}: ${message}`);
        await this.log(
          channel.id,
          kind,
          "failed",
          Date.now() - started,
          (error as { statusCode?: number }).statusCode,
          message,
        );
      }
    }
    throw new BadGatewayException(
      errors.length ? `所有可用渠道均调用失败：${errors.join("；")}` : "当前规格没有可用渠道",
    );
  }

  /**
   * 持久化一次渠道调用结果，供健康判断与历史分析使用。
   *
   * @param channelId - 被调用的供应渠道 ID。
   * @param requestKind - 调用类型，如 text、image 或 video-poll。
   * @param status - 调用结果状态。
   * @param latencyMs - 本次调用耗时，单位毫秒。
   * @param statusCode - 可选 HTTP 状态码。
   * @param errorMessage - 可选错误摘要，写入前限制为 1000 字符。
   * @returns 新建的渠道调用日志。
   */
  private log(
    channelId: string,
    requestKind: string,
    status: string,
    latencyMs: number,
    statusCode?: number,
    errorMessage?: string,
  ) {
    return this.prisma.providerRequestLog.create({
      data: {
        id: newId("provider_log"),
        channelId,
        requestKind,
        status,
        latencyMs,
        statusCode,
        errorMessage: errorMessage?.slice(0, 1000),
      },
    });
  }
}
