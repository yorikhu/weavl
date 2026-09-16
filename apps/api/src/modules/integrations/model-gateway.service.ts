import { BadGatewayException, Injectable } from "@nestjs/common";
import { newId } from "../../common/id";
import { PrismaService } from "../../infrastructure/database/prisma.service";
import { OpenAiCompatibleAdapter } from "./providers/openai-compatible.adapter";
import { ProviderRegistryService } from "./provider-registry.service";
import type { TextGenerationRequest } from "./provider.types";
@Injectable()
export class ModelGatewayService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: ProviderRegistryService,
    private readonly adapter: OpenAiCompatibleAdapter,
  ) {}
  async generateText(modelId: string, request: TextGenerationRequest) {
    const channels = await this.registry.candidates("text", modelId);
    const errors: string[] = [];
    for (const channel of channels) {
      const started = Date.now();
      try {
        const result = await this.adapter.generateText(channel, request);
        await this.log(channel.id, "text", "succeeded", Date.now() - started, result.statusCode);
        return { ...result, model: modelId, mode: "live" as const };
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
