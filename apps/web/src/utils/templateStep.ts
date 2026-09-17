/** 后端 step.type → 中文标签与色相（与画布 KIND_META 色一致） */
export const STEP_KIND_META: Record<string, { label: string; color: string }> = {
  llm: { label: "LLM", color: "#d44b7e" },
  "image-gen": { label: "生图", color: "#d4537e" },
  "video-gen": { label: "生视频", color: "#378add" },
  tts: { label: "配音", color: "#378add" },
  ffmpeg: { label: "合成", color: "#378add" },
  http: { label: "请求", color: "#5e5e66" },
  mcp: { label: "MCP", color: "#5e5e66" },
};

/**
 * 从步骤类型归一化到展示类型，未识别类型回退到 LLM。
 *
 * @param type - 工作流步骤类型。
 * @returns 节点展示元数据的键。
 */
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

/**
 * 获取步骤的中文展示名称。
 *
 * @param id - 工作流步骤标识。
 * @returns 已知中文名或原始标识。
 */
export function stepNameOf(id: string): string {
  return STEP_NAME_ZH[id] ?? id;
}
