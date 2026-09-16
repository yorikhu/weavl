import { Injectable } from "@nestjs/common";
import { ModelGatewayService } from "../integrations/model-gateway.service";
import { ProviderRegistryService } from "../integrations/provider-registry.service";
export type TextModelId = "weavl-text" | "volcengine-text" | "aliyun-text" | "zenmux-text";
@Injectable()
export class TextGenerationService {
  constructor(
    private readonly gateway: ModelGatewayService,
    private readonly registry: ProviderRegistryService,
  ) {}
  async models() {
    const channels = await this.registry.list();
    const configured = (id: string) =>
      channels.some(
        (x) =>
          x.modelKind === "text" &&
          (id === "weavl-text" || x.modelId === id) &&
          x.enabled &&
          Boolean(process.env[x.apiKeyEnv]),
      );
    return [
      { id: "weavl-text", label: "Weavl Text", provider: "auto", configured: configured("weavl-text") },
      { id: "volcengine-text", label: "豆包", provider: "volcengine", configured: configured("volcengine-text") },
      { id: "aliyun-text", label: "通义千问", provider: "aliyun", configured: configured("aliyun-text") },
      { id: "zenmux-text", label: "ZenMux Text", provider: "zenmux", configured: configured("zenmux-text") },
    ];
  }
  async generate(modelId: TextModelId, prompt: string) {
    try {
      return await this.gateway.generateText(modelId, { prompt });
    } catch (error) {
      const models = await this.models();
      if (models.some((x) => x.configured)) throw error;
      return { content: this.mock(prompt), model: modelId, mode: "mock" as const };
    }
  }
  private mock(prompt: string) {
    return `文案初稿\n\n${prompt}\n\n从一个清晰的问题出发，把真正值得表达的部分留下来。先交代背景与对象，再展开核心观点，并用具体细节支撑判断。结尾收束到下一步行动，让内容既完整，也保留继续生长的空间。`;
  }
}
