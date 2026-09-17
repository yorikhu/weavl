import { Injectable } from "@nestjs/common";
import type { GeneratedMedia, ImageGenerationRequest, ProviderChannel } from "../provider.types";
import { ProviderHttpService } from "./provider-http.service";

interface OpenAiImageResponse {
  data?: Array<{ b64_json?: string; url?: string }>;
  output_format?: string;
}

/** 使用 OpenAI Images 兼容协议生成或编辑图片。 */
@Injectable()
export class OpenAiImageAdapter {
  constructor(private readonly http: ProviderHttpService) {}

  /**
   * 有参考图时调用图片编辑接口并启用高保真输入，无参考图时调用文生图接口。
   *
   * @param channel - OpenAI Images 兼容渠道。
   * @param request - 标准化图片生成参数。
   * @returns 标准化图片产物及 HTTP 状态码。
   * @throws {Error} 供应商没有返回可用图片时抛出。
   */
  async generate(channel: ProviderChannel, request: ImageGenerationRequest) {
    const references = request.referenceImages ?? (request.referenceImage ? [request.referenceImage] : []);
    const editing = references.length > 0;
    const root = channel.baseUrl.replace(/\/$/, "");
    const body = editing
      ? this.editForm(channel, request, references)
      : {
          model: channel.remoteModel,
          prompt: request.prompt,
          n: request.count || 1,
          ...(request.size ? { size: request.size } : {}),
          ...(request.quality ? { quality: request.quality } : {}),
        };
    const { data, statusCode } = await this.http.post<OpenAiImageResponse>(
      channel,
      `${root}/images/${editing ? "edits" : "generations"}`,
      body,
    );
    const mimeType = this.mimeType(data.output_format);
    const outputs = (data.data || []).flatMap((image): GeneratedMedia[] => {
      if (image.b64_json) return [{ content: `data:${mimeType};base64,${image.b64_json}`, mimeType }];
      if (image.url) return [{ content: image.url, mimeType }];
      return [];
    });
    if (!outputs.length) throw new Error("模型没有返回图片");
    return { outputs, statusCode };
  }

  /**
   * 按 OpenAI Images 官方格式把参考图作为真实文件上传。
   * ZenMux 虽也声明支持 JSON Data URL，但部分 GPT Image 2 多图请求会稳定返回平台 500。
   */
  private editForm(
    channel: ProviderChannel,
    request: ImageGenerationRequest,
    references: NonNullable<ImageGenerationRequest["referenceImages"]>,
  ) {
    const form = new FormData();
    form.append("model", channel.remoteModel);
    form.append("prompt", request.prompt);
    form.append("input_fidelity", "high");
    form.append("n", String(request.count || 1));
    if (request.size) form.append("size", request.size);
    if (request.quality) form.append("quality", request.quality);
    references.forEach((image, index) => {
      const bytes = Uint8Array.from(Buffer.from(image.data, "base64"));
      form.append(
        "image[]",
        new Blob([bytes], { type: image.mimeType }),
        `reference-${index + 1}.${this.extension(image.mimeType)}`,
      );
    });
    return form;
  }

  /** 将图片 MIME 类型转换为 multipart 文件名后缀。 */
  private extension(mimeType: string) {
    if (mimeType === "image/jpeg") return "jpg";
    if (mimeType === "image/webp") return "webp";
    return "png";
  }

  /** 将供应商输出格式转换为 MIME 类型。 */
  private mimeType(format?: string) {
    if (format === "jpeg" || format === "jpg") return "image/jpeg";
    if (format === "webp") return "image/webp";
    return "image/png";
  }
}
