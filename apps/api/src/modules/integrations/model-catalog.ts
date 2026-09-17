import type { GenerationModel, ProviderChannel, ProviderProtocol } from "./provider.types";

interface ZenMuxModel extends GenerationModel {
  remoteModel: string;
  protocol: ProviderProtocol;
  priority: number;
}

/**
 * 面向产品界面的自动模型入口。
 * 自动入口不绑定供应商，运行时会从同类型的健康渠道中按优先级选择。
 */
export const AUTO_MODELS: GenerationModel[] = [
  {
    id: "weavl-text",
    kind: "text",
    label: "Weavl Text",
    maker: "Weavl",
    description: "按可用性和优先级自动选择文本模型",
    isAuto: true,
  },
  {
    id: "weavl-image",
    kind: "image",
    label: "Weavl Image",
    maker: "Weavl",
    description: "按可用性和优先级自动选择图片模型",
    isAuto: true,
  },
  {
    id: "weavl-video",
    kind: "video",
    label: "Weavl Video",
    maker: "Weavl",
    description: "按可用性和优先级自动选择视频模型",
    isAuto: true,
  },
];

/** 首批 ZenMux 模型。modelId 是平台稳定标识，remoteModel 是供应商实际标识。 */
export const ZENMUX_MODELS: ZenMuxModel[] = [
  {
    id: "deepseek-v4.1-flash",
    kind: "text",
    label: "DeepSeek V4.1 Flash",
    maker: "DeepSeek",
    description: "高吞吐长上下文文本与视觉理解模型",
    remoteModel: "deepseek/deepseek-v4.1-flash",
    protocol: "openai-chat",
    priority: 10,
  },
  {
    id: "atria-dawn-preview",
    kind: "text",
    label: "Atria Dawn Preview (Free)",
    maker: "Atria",
    description: "面向复杂任务执行与研究工作的免费预览模型",
    remoteModel: "atria-asi/atria-dawn-preview",
    protocol: "openai-chat",
    priority: 20,
  },
  {
    id: "ling-3.0-flash-vl",
    kind: "text",
    label: "Ling-3.0-flash-VL",
    maker: "inclusionAI",
    description: "支持视觉理解的快速多模态模型",
    remoteModel: "inclusionai/ling-3.0-flash-vl",
    protocol: "openai-chat",
    priority: 30,
  },
  {
    id: "kimi-k2.8-preview",
    kind: "text",
    label: "Kimi K2.8 Preview",
    maker: "MoonshotAI",
    description: "支持长上下文与可调推理强度的预览模型",
    remoteModel: "moonshotai/kimi-k2.8-preview",
    protocol: "openai-chat",
    priority: 40,
  },
  {
    id: "gpt-image-2.5-flare",
    kind: "image",
    label: "GPT-Image-2.5-Flare",
    maker: "OpenAI",
    description: "偏速度与高频创作的图片生成模型",
    remoteModel: "openai/gpt-image-2.5-flare",
    protocol: "vertex-image",
    priority: 10,
  },
  {
    id: "gpt-image-2.5-sunburst",
    kind: "image",
    label: "GPT-Image-2.5-Sunburst",
    maker: "OpenAI",
    description: "偏高质量输出的图片生成模型",
    remoteModel: "openai/gpt-image-2.5-sunburst",
    protocol: "vertex-image",
    priority: 20,
  },
  {
    id: "gemini-3.1-flash-image",
    kind: "image",
    label: "Nano Banana 2",
    maker: "Google",
    description: "Gemini 3.1 Flash Image 图片生成模型",
    remoteModel: "google/gemini-3.1-flash-image",
    protocol: "vertex-generate-content",
    priority: 30,
  },
  {
    id: "gemini-omni-1.1-flash-preview",
    kind: "image",
    label: "Gemini Omni 1.1 Flash Preview",
    maker: "Google",
    description: "支持图像与多模态输出的预览模型",
    remoteModel: "google/gemini-omni-1.1-flash-preview",
    protocol: "vertex-generate-content",
    priority: 40,
  },
  {
    id: "doubao-seedance-2.0",
    kind: "video",
    label: "Doubao-Seedance-2.0",
    maker: "ByteDance",
    description: "支持文生视频、图生视频和参考音频的视频模型",
    remoteModel: "bytedance/doubao-seedance-2.0",
    protocol: "vertex-video",
    priority: 10,
  },
  {
    id: "doubao-seedance-2.5",
    kind: "video",
    label: "Doubao-Seedance-2.5",
    maker: "ByteDance",
    description: "Seedance 新一代视频生成模型",
    remoteModel: "bytedance/doubao-seedance-2.5",
    protocol: "vertex-video",
    priority: 20,
  },
  {
    id: "minimax-h3-max",
    kind: "video",
    label: "MiniMax H3 Max",
    maker: "MiniMax",
    description: "兼顾生成速度的文生视频与图生视频模型",
    remoteModel: "minimax/minimax-h3-max",
    protocol: "vertex-video",
    priority: 30,
  },
  {
    id: "wan3.0-video-prime",
    kind: "video",
    label: "Wan3.0-Video-Prime",
    maker: "Alibaba",
    description: "支持多模态参考输入的高速视频生成模型",
    remoteModel: "alibaba/wan3.0-video-prime",
    protocol: "vertex-video",
    priority: 40,
  },
];

/** 可供前端选择的完整模型目录，包括自动入口与明确指定的模型。 */
export const GENERATION_MODELS: GenerationModel[] = [...AUTO_MODELS, ...ZENMUX_MODELS];

/**
 * 判断模型标识是否为指定生成类型的自动路由入口。
 *
 * @param kind - 要检查的生成类型。
 * @param modelId - 客户端提交的稳定模型标识。
 * @returns 模型是否应使用该类型的全部健康渠道参与路由。
 */
export function isAutoModel(kind: ProviderChannel["modelKind"], modelId: string) {
  return modelId === `weavl-${kind}`;
}
