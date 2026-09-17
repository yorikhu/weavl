import { BadRequestException, Injectable } from "@nestjs/common";
import { ModelGatewayService } from "../integrations/model-gateway.service";
import { ProviderRegistryService } from "../integrations/provider-registry.service";

/** 文本生成业务入口，负责模型校验及开发环境的无密钥回退。 */
@Injectable()
export class TextGenerationService {
  constructor(
    private readonly gateway: ModelGatewayService,
    private readonly registry: ProviderRegistryService,
  ) {}

  /**
   * 返回文本模型目录和各模型当前配置状态。
   *
   * @returns 文本模型选择项列表。
   */
  async models() {
    return this.registry.models("text");
  }

  /**
   * 调用文本模型；仅在所有文本渠道均未配置时返回本地演示文案。
   *
   * @param modelId - 文本模型或自动路由标识。
   * @param prompt - 用户输入的文本指令。
   * @returns 实时模型结果或本地演示结果。
   * @throws {BadRequestException} 模型不存在或类型不匹配时抛出。
   */
  async generate(modelId: string, prompt: string) {
    const models = await this.models();
    if (!models.some((model) => model.id === modelId)) throw new BadRequestException("文本模型不存在或类型不匹配");
    try {
      return await this.gateway.generateText(modelId, { prompt });
    } catch (error) {
      if (models.some((x) => x.configured)) throw error;
      // TODO(generation): 正式环境启用强制配置后移除无密钥演示回退。
      return { content: this.mock(prompt), model: modelId, mode: "mock" as const };
    }
  }

  /**
   * 生成无供应商密钥时使用的确定性演示内容。
   *
   * @param prompt - 原始用户指令。
   * @returns 可在开发环境展示的文案初稿。
   */
  private mock(prompt: string) {
    return `文案初稿\n\n${prompt}\n\n从一个清晰的问题出发，把真正值得表达的部分留下来。先交代背景与对象，再展开核心观点，并用具体细节支撑判断。结尾收束到下一步行动，让内容既完整，也保留继续生长的空间。`;
  }
}
