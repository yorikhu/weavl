import { BadGatewayException, Injectable } from "@nestjs/common";
import type { ProviderChannel, TextGenerationRequest, TextProviderAdapter } from "../provider.types";

/** 将平台文本请求转换为 OpenAI Chat Completions 兼容请求。 */
@Injectable()
export class OpenAiCompatibleAdapter implements TextProviderAdapter {
  /**
   * 调用渠道并提取首个 assistant 文本，同时保留 HTTP 状态供日志记录。
   *
   * @param channel - OpenAI Chat 兼容供应渠道。
   * @param request - 标准化文本生成参数。
   * @returns 首个 assistant 文本和 HTTP 状态码。
   * @throws {BadGatewayException} 渠道未配置密钥时抛出。
   */
  async generateText(channel: ProviderChannel, request: TextGenerationRequest) {
    const key = process.env[channel.apiKeyEnv];
    if (!key) throw new BadGatewayException(`渠道 ${channel.label} 缺少 ${channel.apiKeyEnv}`);
    const root = channel.baseUrl.replace(/\/$/, "");
    const url = root.endsWith("/chat/completions") ? root : `${root}/chat/completions`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Number(process.env.WEAVL_PROVIDER_TIMEOUT_MS || 30000));
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: channel.remoteModel,
          messages: [
            {
              role: "system",
              content: request.system || "你是 Weavl 的中文内容创作助手。直接交付可用成稿，不解释生成过程。",
            },
            { role: "user", content: request.prompt },
          ],
          max_completion_tokens: request.maxOutputTokens ?? 1000,
        }),
        signal: controller.signal,
      });
      if (!response.ok)
        throw Object.assign(new Error(`模型服务返回 ${response.status}`), { statusCode: response.status });
      const result = (await response.json()) as {
        id?: string;
        choices?: Array<{ message?: { content?: string } }>;
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
          prompt_tokens_details?: { cached_tokens?: number };
        };
      };
      const content = result.choices?.[0]?.message?.content?.trim();
      if (!content) throw new Error("模型没有返回文本");
      const inputTokens = this.nonNegativeInteger(result.usage?.prompt_tokens);
      const outputTokens = this.nonNegativeInteger(result.usage?.completion_tokens);
      const totalTokens = this.nonNegativeInteger(result.usage?.total_tokens);
      const usage =
        inputTokens !== undefined && outputTokens !== undefined
          ? {
              inputTokens,
              outputTokens,
              totalTokens: totalTokens ?? inputTokens + outputTokens,
              cachedInputTokens: this.nonNegativeInteger(result.usage?.prompt_tokens_details?.cached_tokens),
            }
          : undefined;
      return { content, statusCode: response.status, generationId: result.id, usage };
    } finally {
      clearTimeout(timer);
    }
  }

  /** 将供应商用量字段收敛为非负整数，无效字段不参与实际结算。 */
  private nonNegativeInteger(value: unknown) {
    return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : undefined;
  }
}
