import { Injectable } from "@nestjs/common";
import type { GeneratedMedia, ProviderChannel, VideoGenerationRequest, VideoOperationResult } from "../provider.types";
import { ProviderHttpService } from "./provider-http.service";

type VertexVideo = { bytesBase64Encoded?: string; mimeType?: string; gcsUri?: string; uri?: string };

/** 将平台视频请求适配到 ZenMux Vertex 长任务接口。 */
@Injectable()
export class VertexVideoAdapter {
  constructor(private readonly http: ProviderHttpService) {}

  /**
   * 提交长任务并返回供应商 operationName，后续轮询必须继续使用同一渠道。
   *
   * @param channel - Vertex 视频供应渠道。
   * @param request - 标准化视频生成参数。
   * @returns 供应商长任务标识和 HTTP 状态码。
   * @throws {Error} 响应中缺少任务标识时抛出。
   */
  async submit(channel: ProviderChannel, request: VideoGenerationRequest) {
    const { url } = this.endpoint(channel, "predictLongRunning");
    const instance: Record<string, unknown> = { prompt: request.prompt };
    if (request.referenceImage) {
      instance.image = {
        bytesBase64Encoded: request.referenceImage.data,
        mimeType: request.referenceImage.mimeType,
      };
    }
    const response = await this.http.post<{ name?: string }>(channel, url, {
      instances: [instance],
      parameters: {
        sampleCount: request.count || 1,
        ...(request.ratio ? { aspectRatio: request.ratio } : {}),
        ...(request.resolution ? { resolution: request.resolution } : {}),
        ...(request.durationSeconds ? { durationSeconds: request.durationSeconds } : {}),
        ...(request.generateAudio !== undefined ? { generateAudio: request.generateAudio } : {}),
      },
    });
    if (!response.data.name) throw new Error("视频模型没有返回任务标识");
    return { operationName: response.data.name, statusCode: response.statusCode };
  }

  /**
   * 查询长任务状态，并兼容 videos 与 generatedVideos 两种完成响应。
   *
   * @param channel - 创建任务时使用的 Vertex 视频渠道。
   * @param operationName - 供应商长任务标识。
   * @returns 标准化任务状态、媒体产物或过滤错误。
   */
  async poll(channel: ProviderChannel, operationName: string): Promise<VideoOperationResult & { statusCode: number }> {
    const { url } = this.endpoint(channel, "fetchPredictOperation");
    const { data, statusCode } = await this.http.post<{
      done?: boolean;
      error?: { message?: string };
      response?: {
        videos?: VertexVideo[];
        generatedVideos?: Array<{ video?: VertexVideo }>;
        raiMediaFilteredReasons?: string[];
      };
    }>(channel, url, { operationName });
    if (data.error) return { done: true, error: data.error.message || "视频生成失败", statusCode };
    if (!data.done) return { done: false, statusCode };
    const videos = [
      ...(data.response?.videos || []),
      ...(data.response?.generatedVideos || []).flatMap((item) => (item.video ? [item.video] : [])),
    ];
    const outputs = videos.flatMap((video) => this.media(video));
    if (!outputs.length)
      return {
        done: true,
        error: data.response?.raiMediaFilteredReasons?.join("；") || "视频模型没有返回可用产物",
        statusCode,
      };
    return { done: true, outputs, statusCode };
  }

  /**
   * 构造指定模型和长任务动作的 Vertex REST 地址。
   *
   * @param channel - 包含 baseUrl 和 remoteModel 的渠道。
   * @param action - 提交或查询长任务的 Vertex 动作。
   * @returns publisher、model 和完整请求地址。
   * @throws {Error} 模型标识不符合 provider/model 格式时抛出。
   */
  private endpoint(channel: ProviderChannel, action: "predictLongRunning" | "fetchPredictOperation") {
    const separator = channel.remoteModel.indexOf("/");
    if (separator < 1) throw new Error(`Vertex 模型标识无效：${channel.remoteModel}`);
    const publisher = channel.remoteModel.slice(0, separator);
    const model = channel.remoteModel.slice(separator + 1);
    const root = channel.baseUrl.replace(/\/$/, "");
    return { publisher, model, url: `${root}/v1/publishers/${publisher}/models/${model}:${action}` };
  }

  /**
   * 将视频内联数据或远程地址归一化为平台媒体结构。
   *
   * @param media - 单条 Vertex 视频结果。
   * @returns 零个或一个标准化媒体对象。
   */
  private media(media: VertexVideo): GeneratedMedia[] {
    const mimeType = media.mimeType || "video/mp4";
    if (media.bytesBase64Encoded) return [{ content: `data:${mimeType};base64,${media.bytesBase64Encoded}`, mimeType }];
    const url = media.gcsUri || media.uri;
    return url ? [{ content: url, mimeType }] : [];
  }
}
