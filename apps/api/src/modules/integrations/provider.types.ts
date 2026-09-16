export interface ProviderChannel {
  id: string;
  provider: string;
  modelKind: "text" | "image" | "video" | "audio" | "avatar";
  modelId: string;
  remoteModel: string;
  label: string;
  baseUrl: string;
  apiKeyEnv: string;
  priority: number;
  enabled: boolean;
  failureThreshold: number;
  cooldownSeconds: number;
}
export interface TextGenerationRequest {
  prompt: string;
  system?: string;
}
export interface TextGenerationResult {
  content: string;
  channelId: string;
  provider: string;
  latencyMs: number;
}
export interface ProviderAdapter {
  generateText(
    channel: ProviderChannel,
    request: TextGenerationRequest,
  ): Promise<{ content: string; statusCode: number }>;
}
