import type { InputDef, Step } from "@weavl/shared";

/** templates API 列表返回的模板摘要 */
export interface TemplateSummary {
  id: string;
  name: string;
  vertical: string;
  category: "image" | "video" | "script" | "voice" | string;
  price: string;
  cost: { min: number; max: number };
  inputs: InputDef[];
  gates: { afterStep: string; title: string; description?: string; candidates?: number }[];
  totalSteps: number;
}

/** templates API 详情返回（GET /templates/:id）——含完整 steps/output */
export interface TemplateDetail extends TemplateSummary {
  steps: Step[];
}

/** 前端展示补充信息（后端契约之外的运营数据，暂 mock） */
export interface TemplateDisplay {
  /** 卡片节点条：按流程顺序的节点类型色 */
  flow: StepKind[];
  /** 流程摘要，如「选题 → 封面 → 正文」 */
  summary: string;
  uses: string;
  /** 简介首句，用于 Agent 开场白 */
  intro: string;
}

export type StepKind = "llm" | "image" | "video" | "check" | "output";

/** 展示信息按模板 id 关联；未命中时用默认 */
export const TEMPLATE_DISPLAY: Record<string, TemplateDisplay> = {
  "ecom.xhs-note": {
    flow: ["llm", "llm", "llm", "image", "output"],
    summary: "选题 → 文案 → 封面 → 检查 → 内容包",
    uses: "12.4k",
    intro: "这个预设会帮你完成小红书种草图文的全流程",
  },
};

export const DEFAULT_DISPLAY: TemplateDisplay = {
  flow: ["llm", "image", "output"],
  summary: "LLM 编排 → 生成 → 检查",
  uses: "—",
  intro: "这个预设会按流程帮你完成内容创作",
};

/** 分类筛选标签 → 模板 category 匹配 */
export const CATEGORY_TABS = [
  { key: "all", label: "全部" },
  { key: "image", label: "图文" },
  { key: "video", label: "视频" },
  { key: "script", label: "脚本" },
] as const;

/** 后端 step.type → 中文标签与色相（与画布 KIND_META 色一致） */
export const STEP_KIND_META: Record<string, { label: string; color: string }> = {
  "llm": { label: "LLM", color: "#d44b7e" },
  "image-gen": { label: "生图", color: "#d4537e" },
  "video-gen": { label: "生视频", color: "#378add" },
  "tts": { label: "配音", color: "#378add" },
  "ffmpeg": { label: "合成", color: "#378add" },
  "http": { label: "请求", color: "#5e5e66" },
  "mcp": { label: "MCP", color: "#5e5e66" },
};

/** 从 step.type 归一化到展示 kind（未识别归 LLM） */
export function stepKindOf(type: string): keyof typeof STEP_KIND_META {
  return (type in STEP_KIND_META ? type : "llm") as keyof typeof STEP_KIND_META;
}

/** 步骤 id → 展示名（Step 契约只有 id，中文名是运营文案，放前端） */
export const STEP_NAME_ZH: Record<string, string> = {
  topics: "选题生成",
  copywriting: "文案生成",
  "cover-concept": "封面方案",
  cover: "封面生成",
  check: "质量检查",
  package: "内容包",
};

export function stepNameOf(id: string): string {
  return STEP_NAME_ZH[id] ?? id;
}

