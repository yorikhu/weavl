import { Injectable } from "@nestjs/common";
import type { GeneratedMedia, ImageGenerationRequest, ProviderChannel } from "../provider.types";
import { ProviderHttpService } from "./provider-http.service";

type VertexImage = { bytesBase64Encoded?: string; mimeType?: string; gcsUri?: string; raiFilteredReason?: string };

/**
 * ZenMux Vertex 图片适配器。
 * 同时兼容 Imagen/OpenAI 风格的 predict 和 Gemini 风格的 generateContent 响应。
 */
@Injectable()
export class VertexImageAdapter {
  constructor(private readonly http: ProviderHttpService) {}

  /**
   * 根据渠道协议构造请求，并将 base64 或远程地址统一转换为 GeneratedMedia。
   *
   * @param channel - Vertex 图片或 generateContent 供应渠道。
   * @param request - 标准化图片生成参数。
   * @returns 图片产物和供应商 HTTP 状态码。
   * @throws {Error} 模型标识无效、内容被过滤或响应不含图片时抛出。
   */
  async generate(channel: ProviderChannel, request: ImageGenerationRequest) {
    const [publisher, model] = this.modelPath(channel.remoteModel);
    const root = channel.baseUrl.replace(/\/$/, "");
    if (channel.protocol === "vertex-generate-content") {
      const responses = await Promise.all(
        Array.from({ length: request.count || 1 }, () =>
          this.http.post<{
            candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }> } }>;
          }>(channel, `${root}/v1/publishers/${publisher}/models/${model}:generateContent`, {
            contents: [{ role: "user", parts: [{ text: request.prompt }] }],
            generationConfig: {
              responseModalities: ["TEXT", "IMAGE"],
              imageConfig: {
                ...(request.ratio ? { aspectRatio: request.ratio } : {}),
                ...(request.resolution ? { imageSize: request.resolution } : {}),
              },
            },
          }),
        ),
      );
      const outputs = responses.flatMap(({ data }) =>
        (data.candidates || [])
          .flatMap((candidate) => candidate.content?.parts || [])
          .flatMap((part) => {
            const media = part.inlineData;
            return media?.data ? [this.inline(media.data, media.mimeType)] : [];
          }),
      );
      if (!outputs.length) throw new Error("模型没有返回图片");
      return { outputs, statusCode: responses[0]?.statusCode || 200 };
    }

    const instance: Record<string, unknown> = { prompt: request.prompt };
    if (request.referenceImage) {
      instance.image = {
        bytesBase64Encoded: request.referenceImage.data,
        mimeType: request.referenceImage.mimeType,
      };
    }
    const { data, statusCode } = await this.http.post<{ predictions?: VertexImage[] }>(
      channel,
      `${root}/v1/publishers/${publisher}/models/${model}:predict`,
      {
        instances: [instance],
        parameters: {
          sampleCount: request.count || 1,
          ...(request.ratio ? { aspectRatio: request.ratio } : {}),
          ...(request.size ? { imageSize: request.size } : {}),
          ...(request.quality ? { quality: request.quality } : {}),
        },
      },
    );
    const predictions = data.predictions || [];
    const outputs = predictions.flatMap((media) => this.media(media));
    if (!outputs.length)
      throw new Error(predictions.find((media) => media.raiFilteredReason)?.raiFilteredReason || "模型没有返回图片");
    return { outputs, statusCode };
  }

  /**
   * 将 provider/model 格式拆分为 Vertex 路径所需的 publisher 与 model。
   *
   * @param remoteModel - 供应商模型标识。
   * @returns 由 publisher 和 model 组成的只读元组。
   * @throws {Error} 模型标识不符合 provider/model 格式时抛出。
   */
  private modelPath(remoteModel: string) {
    const separator = remoteModel.indexOf("/");
    if (separator < 1) throw new Error(`Vertex 模型标识无效：${remoteModel}`);
    return [remoteModel.slice(0, separator), remoteModel.slice(separator + 1)] as const;
  }

  /**
   * 将裸 base64 图片包装为可直接消费的 data URL。
   *
   * @param data - 图片的 base64 内容。
   * @param mimeType - 图片 MIME 类型，默认使用 image/png。
   * @returns 标准化媒体对象。
   */
  private inline(data: string, mimeType = "image/png"): GeneratedMedia {
    return { content: `data:${mimeType};base64,${data}`, mimeType };
  }

  /**
   * 提取 Vertex predict 返回的内联图片或对象存储地址。
   *
   * @param media - 单条 Vertex 图片预测结果。
   * @returns 零个或一个标准化媒体对象。
   */
  private media(media: VertexImage): GeneratedMedia[] {
    if (media.bytesBase64Encoded) return [this.inline(media.bytesBase64Encoded, media.mimeType)];
    if (media.gcsUri) return [{ content: media.gcsUri, mimeType: media.mimeType || "image/png" }];
    return [];
  }
}
