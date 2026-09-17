/**
 * 一个可独立调用的模型供应渠道。
 * 多条渠道可以共享 modelId，并通过不同 provider、remoteModel 和协议提供同一逻辑模型。
 */
export interface ProviderChannel {
  id: string;
  providerId: string;
  provider: string;
  protocol: ProviderProtocol;
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

/** 模型供应商当前支持的请求协议。 */
export type ProviderProtocol = "openai-chat" | "vertex-image" | "vertex-generate-content" | "vertex-video";

/** 暴露给客户端的稳定模型元数据，不包含供应商密钥和端点。 */
export interface GenerationModel {
  id: string;
  kind: ProviderChannel["modelKind"];
  label: string;
  maker: string;
  description: string;
  isAuto?: boolean;
  enabled?: boolean;
  capabilities?: Record<string, unknown>;
}

/** 标准化后的文本生成入参。 */
export interface TextGenerationRequest {
  prompt: string;
  system?: string;
  maxOutputTokens?: number;
}

/** 供应商同步返回的实际 Token 用量。 */
export interface ProviderTokenUsage {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
  totalTokens: number;
}

/** 文本渠道执行结果及可观测信息。 */
export interface TextGenerationResult {
  content: string;
  channelId: string;
  provider: string;
  latencyMs: number;
  generationId?: string;
  usage?: ProviderTokenUsage;
}

/** 不同图片供应商适配器共享的生成参数。 */
export interface ImageGenerationRequest {
  prompt: string;
  count?: number;
  ratio?: string;
  size?: string;
  resolution?: string;
  quality?: string;
  referenceImage?: { data: string; mimeType: string };
}

/** 不同视频供应商适配器共享的生成参数。 */
export interface VideoGenerationRequest {
  prompt: string;
  count?: number;
  ratio?: string;
  resolution?: string;
  durationSeconds?: number;
  generateAudio?: boolean;
  referenceImage?: { data: string; mimeType: string };
}

/** 供应商返回的媒体内容；content 可以是 data URL 或远程地址。 */
export interface GeneratedMedia {
  content: string;
  mimeType: string;
}

/** 异步视频任务单次轮询后的标准化结果。 */
export interface VideoOperationResult {
  done: boolean;
  outputs?: GeneratedMedia[];
  error?: string;
}

/** OpenAI Chat 兼容文本渠道需要实现的最小适配器契约。 */
export interface TextProviderAdapter {
  generateText(
    channel: ProviderChannel,
    request: TextGenerationRequest,
  ): Promise<{ content: string; statusCode: number; generationId?: string; usage?: ProviderTokenUsage }>;
}
