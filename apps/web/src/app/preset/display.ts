/** 预设市场与详情页使用的运营展示信息，暂由前端维护。 */
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
