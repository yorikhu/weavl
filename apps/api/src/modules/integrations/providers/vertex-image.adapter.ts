import { Injectable } from "@nestjs/common";
import type { GeneratedMedia, ImageGenerationRequest, ProviderChannel } from "../provider.types";
import { ProviderHttpService } from "./provider-http.service";

type VertexImage = { bytesBase64Encoded?: string; mimeType?: string; gcsUri?: string; raiFilteredReason?: string };
type GenerateContentPart = {
  text?: string;
  inlineData?: { data?: string; mimeType?: string };
  inline_data?: { data?: string; mime_type?: string };
  fileData?: { fileUri?: string; mimeType?: string };
  file_data?: { file_uri?: string; mime_type?: string };
};
type GenerateContentResponse = {
  candidates?: Array<{ content?: { parts?: GenerateContentPart[] } }>;
};

/**
 * Vertex 与 Gemini 原生图片适配器。
 * 同时兼容 Imagen predict、Vertex generateContent 和供应商 Gemini 原生端点。
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
    const root = channel.baseUrl.replace(/\/$/, "");
    if (channel.protocol === "gemini-generate-content") {
      return this.generateContent(channel, request, `${root}/v1beta/models/${channel.remoteModel}:generateContent`);
    }
    if (channel.protocol === "vertex-generate-content") {
      const [publisher, model] = this.modelPath(channel.remoteModel);
      return this.generateContent(
        channel,
        request,
        `${root}/v1/publishers/${publisher}/models/${model}:generateContent`,
      );
    }

    const [publisher, model] = this.modelPath(channel.remoteModel);
    const instance: Record<string, unknown> = { prompt: request.prompt };
    const referenceImage = request.referenceImages?.[0] ?? request.referenceImage;
    if (referenceImage) {
      instance.image = {
        bytesBase64Encoded: referenceImage.data,
        mimeType: referenceImage.mimeType,
      };
    }
    const { data, statusCode } = await this.http.post<{ predictions?: VertexImage[] }>(
      channel,
      `${root}/v1/publishers/${publisher}/models/${model}:predict`,
      {
        instances: [instance],
        parameters: {
          sampleCount: request.count || 1,
          /* 精确尺寸已经包含比例，避免供应商同时收到两个尺寸约束后采用错误方向。 */
          ...(!request.size && request.ratio ? { aspectRatio: request.ratio } : {}),
          /* OpenAI 图片模型使用精确 imageSize；其他模型没有尺寸时才回退到分辨率档位。 */
          ...(request.size ? { imageSize: request.size } : {}),
          ...(!request.size && request.resolution ? { sampleImageSize: request.resolution } : {}),
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
   * 调用 Gemini generateContent，并同时传入提示词与全部参考图。
   *
   * @param channel - Gemini 或 Vertex generateContent 渠道。
   * @param request - 标准化图片生成参数。
   * @param url - 渠道对应的完整 generateContent 地址。
   * @returns 标准化图片产物和首个响应状态码。
   */
  private async generateContent(channel: ProviderChannel, request: ImageGenerationRequest, url: string) {
    const references = request.referenceImages ?? (request.referenceImage ? [request.referenceImage] : []);
    const imagePrompt = `请直接生成图片，不要只返回文字说明、追问或提示词改写。严格依据以下用户要求创作：\n${request.prompt}`;
    const parts = [
      { text: imagePrompt },
      ...references.map((image) => ({ inlineData: { mimeType: image.mimeType, data: image.data } })),
    ];
    const responses = await Promise.all(
      Array.from({ length: request.count || 1 }, () =>
        this.http.post<GenerateContentResponse>(channel, url, {
          contents: [{ role: "user", parts }],
          generationConfig: {
            responseModalities: ["IMAGE"],
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
        .flatMap((part) => this.generateContentMedia(part)),
    );
    if (!outputs.length) {
      const explanation = responses
        .flatMap(({ data }) => data.candidates || [])
        .flatMap((candidate) => candidate.content?.parts || [])
        .map((part) => part.text?.trim())
        .find(Boolean);
      throw new Error(explanation ? `模型仅返回文字：${explanation.slice(0, 160)}` : "模型没有返回图片");
    }
    return { outputs, statusCode: responses[0]?.statusCode || 200 };
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
    if (/^https?:\/\//.test(data)) return { content: data, mimeType };
    if (/^data:image\//.test(data)) {
      return { content: data, mimeType: data.match(/^data:([^;,]+)/)?.[1] || mimeType };
    }
    return { content: `data:${mimeType};base64,${data}`, mimeType };
  }

  /**
   * 兼容 Gemini 标准内联图片以及 GeekNow 返回的 Markdown 图片链接。
   *
   * @param part - generateContent 响应中的单个内容片段。
   * @returns 从片段中识别出的零个或多个图片产物。
   */
  private generateContentMedia(part: GenerateContentPart): GeneratedMedia[] {
    const inline = part.inlineData ??
      (part.inline_data ? { data: part.inline_data.data, mimeType: part.inline_data.mime_type } : undefined);
    if (inline?.data) return [this.inline(inline.data, inline.mimeType)];

    const file = part.fileData ??
      (part.file_data ? { fileUri: part.file_data.file_uri, mimeType: part.file_data.mime_type } : undefined);
    if (file?.fileUri) return [{ content: file.fileUri, mimeType: file.mimeType || this.mimeTypeFromUrl(file.fileUri) }];

    if (!part.text) return [];
    const markdownUrls = [...part.text.matchAll(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/g)].map((match) => match[1]!);
    const urls = markdownUrls.length
      ? markdownUrls
      : /^https?:\/\/\S+$/.test(part.text.trim())
        ? [part.text.trim()]
        : [];
    return urls.map((url) => ({ content: url, mimeType: this.mimeTypeFromUrl(url) }));
  }

  /** 根据图片地址后缀提供存储前的 MIME 类型回退值。 */
  private mimeTypeFromUrl(url: string) {
    const extension = new URL(url).pathname.split(".").at(-1)?.toLowerCase();
    if (extension === "jpg" || extension === "jpeg" || extension === "jfif") return "image/jpeg";
    if (extension === "webp") return "image/webp";
    if (extension === "gif") return "image/gif";
    return "image/png";
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
