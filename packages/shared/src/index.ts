/**
 * weavl · 模板包契约 v1
 *
 * 核心设计（三条铁律）：
 * 1. 步骤模型无关 —— Step 不绑定厂商，模型引用全部走 ModelRef
 * 2. alias 能力解析 —— 按能力（video-gen / image-gen / tts / llm）路由，不锁死 provider
 * 3. 成本进模板 —— cost 是定价与毛利的依据，每个花样必须声明预估成本
 */

export * from "./studio.js";

/* ---------------------------------- 垂直 ---------------------------------- */

/** 已注册的垂直。新增垂直 = 在注册中心加记录，不改核心代码 */
export type VerticalId = "ecom" | "short-drama" | "local-life" | (string & {});

/* --------------------------------- 模板包 ---------------------------------- */

export type TemplateCategory = "image" | "video" | "script" | "voice";

/** 模板包 = 一个目录：manifest.json + prompts/ + assets/ */
export interface TemplateManifest {
  /** 'ecom.product-image' — {vertical}.{slug}，全局唯一 */
  id: string;
  vertical: VerticalId;
  /** 展示名，如 '产品白底图' */
  name: string;
  category: TemplateCategory;
  /** 前端表单 + 参数校验由此生成 */
  inputs: InputDef[];
  /** 工作流编排（模型无关） */
  steps: Step[];
  /** 人工确认点：运行到 gate.afterStep 后暂停等待决策 */
  gates?: ConfirmationGate[];
  /** 输出规范：内容包如何组装（channel → 字段映射） */
  output?: OutputSpec;
  /** 单次运行预估成本（¥）—— 定价与毛利依据 */
  cost: { min: number; max: number };
  price: "free" | "standard" | "premium";
  /** 模板市场封面 */
  cover?: string;
  /** 示例成片 —— 模板市场的"买家秀" */
  demo?: string[];
}

/* ---------------------------------- 输入 ---------------------------------- */

export type InputDef =
  | { type: "text"; name: string; label: string; required?: boolean; placeholder?: string; maxLength?: number }
  | { type: "textarea"; name: string; label: string; required?: boolean; placeholder?: string; maxLength?: number }
  | { type: "number"; name: string; label: string; required?: boolean; min?: number; max?: number; default?: number }
  | { type: "select"; name: string; label: string; required?: boolean; options: { value: string; label: string }[] }
  | { type: "image"; name: string; label: string; required?: boolean; accept?: string[] };

/* ---------------------------------- 步骤 ---------------------------------- */

/**
 * 一梭 = 可组合、可替换模型的原子操作。
 * 步骤间数据通过 outputs 引用传递：{ { step: 'gen-cover'; port: 'image' } }
 */
export type Step =
  | { type: "llm"; id: string; prompt: string; system?: string; model?: ModelRef }
  | { type: "image-gen"; id: string; model?: ModelRef; params?: Record<string, unknown> }
  | { type: "video-gen"; id: string; model?: ModelRef; params?: Record<string, unknown> }
  | { type: "tts"; id: string; voice?: string; model?: ModelRef }
  | { type: "ffmpeg"; id: string; op: "concat" | "overlay" | "resize" | "watermark" }
  | { type: "http"; id: string; url: string; method?: "GET" | "POST" }
  /** 预留 Phloem 生态对接 */
  | { type: "mcp"; id: string; server: string; tool: string };

/* --------------------------------- 模型引用 -------------------------------- */

/** provider 直连（左）或按能力别名解析（右）—— 多模型可切换的核心 */
export type ModelRef = { provider: ModelProvider; model: string } | { alias: ModelAlias };

export type ModelProvider = "kling" | "jimeng" | "hunyuan" | "openai" | "minimax" | (string & {});

/** 能力别名：运行时按当前配置解析到具体 provider/model */
export type ModelAlias = "llm" | "image-gen" | "video-gen" | "tts" | (string & {});

/* ---------------------------------- 运行 ---------------------------------- */

export type RunStatus =
  | "pending"
  | "running"
  /** 前进到确认门，等待用户选择候选或要求重生成 */
  | "awaiting_confirmation"
  | "succeeded"
  | "failed"
  | "cancelled";

/* -------------------------------- 确认门 v2 -------------------------------- */

/**
 * 确认门 = 工作流中的"人工确认点"。
 * 步骤产出 candidates 后暂停，直到用户 confirm / edit-confirm / regenerate。
 */
export interface ConfirmationGate {
  /** 引用 steps 中某一步的 id —— 该步执行完即暂停 */
  afterStep: string;
  /** 展示名，如 '确认选题方向' */
  title: string;
  /** 用户可读的说明 */
  description?: string;
  /** 候选数量（默认 3） */
  candidates?: number;
}

/* --------------------------------- 候选产物 -------------------------------- */

/** 一个候选 = 一步的一次可选项（抽卡的一张） */
export interface CandidateArtifact {
  id: string;
  stepId: string;
  /** TODO(workflow-engine): 图片节点接入真实执行器后扩展为资产引用；当前兼容引擎仅返回描述。 */
  kind: "text" | "image" | "structured";
  content: string;
  /** 差异点标注，如 '测评型' */
  variantLabel?: string;
  createdAt: string;
}

/** 用户对确认门的一次决策 */
export interface ConfirmationDecision {
  gate: string;
  /** 采纳的候选 id；regenerate 时为空 */
  action: "confirm" | "edit-confirm" | "regenerate";
  candidateId?: string;
  /** edit-confirm 时的修改稿 / regenerate 时的反馈意见 */
  note?: string;
  decidedAt: string;
}

/* --------------------------------- 内容包 ---------------------------------- */

/** 输出规范：从步骤产物映射为渠道内容包字段 */
export interface OutputSpec {
  channel: string;
  fields: { key: string; label: string; kind: PackageField["kind"]; fromStep: string }[];
}

/** 内容包 = 面向渠道的最终交付物（版本化） */
export interface ContentPackage {
  id: string;
  runId: string;
  templateId: string;
  /** 渠道，如 'xiaohongshu' —— 决定输出规范 */
  channel: string;
  version: number;
  fields: PackageField[];
  /** 导出物清单（文件名 → 内容或 URL） */
  files: { name: string; kind: "text" | "image" | "pdf"; content: string }[];
  createdAt: string;
}

/** 内容包里的一个组成字段 */
export interface PackageField {
  key: string;
  label: string;
  kind: "title" | "body" | "cover" | "image" | "topic" | "script" | "advice";
  value: string;
}

/** 一次开织（运行）的对外视图 */
export interface RunView {
  id: string;
  templateId: string;
  status: RunStatus;
  /** 当前等待用户决策的确认门（afterStep id），无则空 */
  awaitingGate?: string;
  /** 已完成的一梭数 */
  completedSteps: number;
  totalSteps: number;
  /** 当前确认门的候选列表 */
  candidates?: CandidateArtifact[];
  /** 织品（成片/成品）URL */
  artifactUrls?: string[];
  /** 实际成本（¥），运行结束后回填 */
  actualCost?: number;
  /** 组装完成的内容包 */
  contentPackage?: ContentPackage;
  /** 决策历史（人机协作留痕） */
  decisions?: ConfirmationDecision[];
  error?: string;
  createdAt: string;
  updatedAt: string;
}

/* --------------------------------- 工具函数 -------------------------------- */

/** 从 manifest.id 解析垂直：'ecom.product-image' → 'ecom' */
export function verticalOf(manifestId: string): VerticalId {
  const idx = manifestId.indexOf(".");
  return idx === -1 ? manifestId : manifestId.slice(0, idx);
}

/** 校验 step id 在工作流内唯一，返回错误信息（null = 通过） */
export function validateSteps(steps: Step[]): string | null {
  const seen = new Set<string>();
  for (const step of steps) {
    if (!step.id) return `step id 不能为空: ${JSON.stringify(step)}`;
    if (seen.has(step.id)) return `step id 重复: ${step.id}`;
    seen.add(step.id);
  }
  return null;
}

/** 校验 gates 引用的 afterStep 都存在于 steps 中（null = 通过） */
export function validateGates(steps: Step[], gates: ConfirmationGate[]): string | null {
  const ids = new Set(steps.map((s) => s.id));
  for (const g of gates) {
    if (!ids.has(g.afterStep)) return `gate "${g.title}" 引用了不存在的 step: ${g.afterStep}`;
  }
  return null;
}

/** 校验 output.fields 引用的 fromStep 都存在于 steps 中（null = 通过） */
export function validateOutput(steps: Step[], output?: OutputSpec): string | null {
  if (!output) return null;
  const ids = new Set(steps.map((s) => s.id));
  for (const f of output.fields) {
    if (!ids.has(f.fromStep)) return `输出字段 "${f.key}" 引用了不存在的 step: ${f.fromStep}`;
  }
  return null;
}
