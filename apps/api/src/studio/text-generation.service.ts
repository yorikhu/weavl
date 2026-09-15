import { BadGatewayException, Injectable } from "@nestjs/common";
import { providerConfigs } from "./integrations.controller";

export type TextModelId = "weavl-text" | "volcengine-text" | "aliyun-text" | "zenmux-text";

export interface TextModelOption {
  id: TextModelId;
  label: string;
  provider: "auto" | "volcengine" | "aliyun" | "zenmux";
  configured: boolean;
}

const MODEL_ENV: Record<Exclude<TextModelOption["provider"], "auto">, string> = {
  volcengine: "VOLCENGINE_TEXT_MODEL",
  aliyun: "ALIYUN_TEXT_MODEL",
  zenmux: "ZENMUX_TEXT_MODEL",
};

@Injectable()
export class TextGenerationService {
  models(): TextModelOption[] {
    const providers = providerConfigs();
    const configured = (id: Exclude<TextModelOption["provider"], "auto">) => {
      const provider = providers.find((item) => item.id === id);
      return Boolean(provider?.baseUrl && provider.apiKey && process.env[MODEL_ENV[id]]);
    };
    return [
      {
        id: "weavl-text",
        label: "Weavl Text",
        provider: "auto",
        configured: providers.some((item) => configured(item.id)),
      },
      { id: "volcengine-text", label: "豆包", provider: "volcengine", configured: configured("volcengine") },
      { id: "aliyun-text", label: "通义千问", provider: "aliyun", configured: configured("aliyun") },
      { id: "zenmux-text", label: "ZenMux Text", provider: "zenmux", configured: configured("zenmux") },
    ];
  }

  async generate(
    modelId: TextModelId,
    prompt: string,
  ): Promise<{ content: string; model: TextModelId; mode: "live" | "mock" }> {
    const models = this.models();
    const requested = models.find((model) => model.id === modelId) ?? models[0]!;
    const resolved =
      requested.provider === "auto"
        ? (models.find((model) => model.provider !== "auto" && model.configured) ?? requested)
        : requested;

    if (resolved.provider === "auto" || !resolved.configured) {
      return { content: this.mockContent(prompt), model: requested.id, mode: "mock" };
    }

    const provider = providerConfigs().find((item) => item.id === resolved.provider)!;
    const model = process.env[MODEL_ENV[resolved.provider]]!;
    const baseUrl = provider.baseUrl!.replace(/\/$/, "");
    const endpoint = baseUrl.endsWith("/chat/completions") ? baseUrl : `${baseUrl}/chat/completions`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), provider.timeoutMs);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${provider.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: "你是 Weavl 的中文内容创作助手。直接交付可用成稿，不解释生成过程。" },
            { role: "user", content: prompt },
          ],
        }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`模型服务返回 ${response.status}`);
      const result = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const content = result.choices?.[0]?.message?.content?.trim();
      if (!content) throw new Error("模型没有返回文本");
      return { content, model: requested.id, mode: "live" };
    } catch (cause) {
      throw new BadGatewayException((cause as Error).message || "文本生成失败");
    } finally {
      clearTimeout(timer);
    }
  }

  private mockContent(prompt: string) {
    return `文案初稿\n\n${prompt}\n\n从一个清晰的问题出发，把真正值得表达的部分留下来。先交代背景与对象，再展开核心观点，并用具体细节支撑判断。结尾收束到下一步行动，让内容既完整，也保留继续生长的空间。`;
  }
}
