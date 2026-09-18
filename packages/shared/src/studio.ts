/** 前后端共享的产品层契约，独立于 Prisma、Redis 和对象存储实现。 */
export type AssetKind = "text" | "image" | "video" | "audio" | "pdf" | "word" | "ppt" | "file";
export type ModelKind = "text" | "image" | "video" | "audio" | "avatar";

export interface MediaDimensionCapability {
  ratio: string;
  width: number;
  height: number;
}

/** 后端维护的模型级生成参数，verified=false 表示仍需实际调用校准。 */
export interface MediaGenerationCapabilities {
  verified?: boolean;
  dimensions?: MediaDimensionCapability[];
  /** 分辨率档位对应的真实输出尺寸；同一比例在不同档位可映射到不同 WxH。 */
  dimensionTiers?: Record<string, MediaDimensionCapability[]>;
  qualities?: string[];
  resolutions?: string[];
  durations?: number[];
  counts?: number[];
}

/** 前后端共享的模型选择项；configured 表示当前至少有一条已配置密钥的渠道。 */
export interface GenerationModelOption {
  id: string;
  kind: ModelKind;
  label: string;
  maker: string;
  description: string;
  configured: boolean;
  isAuto?: boolean;
  capabilities?: MediaGenerationCapabilities;
}

/** 平台按当前模型、供应商成本和全局策略计算出的积分预估。 */
export interface GenerationPriceQuote {
  configured: boolean;
  quotable: boolean;
  strategy: "manual-rule" | "provider-cost" | "platform-estimate" | "unavailable";
  billingMode: "fixed" | "metered" | "unavailable";
  ruleId: string | null;
  credits: number;
  reason?: string;
  costCny?: number;
  targetSaleCny?: number;
  chargedValueCny?: number;
  estimatedProfitCny?: number;
  effectiveMarkupRate?: number;
  confidence?: "high" | "medium" | "low";
  assumptions?: string[];
  meteredRates?: Array<{
    key: string;
    label: string;
    creditsPerMTokens: number;
  }>;
  policy?: {
    creditValueCny: number;
    markupRate: number;
    usdCnyRate: number;
  };
}

/** 前端请求积分预估时提交的稳定模型标识及计费参数。 */
export interface GenerationQuoteRequest {
  modelId: string;
  parameters: Record<string, unknown>;
}
export type AssetSource = "personal" | "agent" | "workflow" | "canvas";

/** 画布节点对已持久化资产版本的稳定引用，避免只依赖会过期的访问地址。 */
export type AssetRef = { assetId: string; versionId: string };

export interface StudioUser {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export type AccountPlanId = "Free" | "Plus" | "Pro" | "Max";
export interface AccountPlan {
  id: AccountPlanId;
  name: string;
  storageLimit: number;
  description: string;
  availability: "active" | "request";
}
export interface AccountEvent {
  id: string;
  type: "credit" | "plan_request" | "notice";
  title: string;
  detail: string;
  delta?: number;
  readAt?: string;
  createdAt: string;
}
export interface AccountSummary {
  plan: AccountPlanId;
  credits: number;
  storageUsed: number;
  storageLimit: number;
  unreadNotifications: number;
  pendingPlan?: AccountPlanId;
  events: AccountEvent[];
}

export interface Folder {
  id: string;
  ownerId: string;
  parentId: string | null;
  name: string;
  createdAt: string;
}

export interface AssetVersion {
  id: string;
  createdAt: string;
  name: string;
  mimeType: string;
  size: number;
  /** 文本内容、Data URL 或由对象存储解析出的临时访问地址。 */
  content: string;
}

export interface Asset {
  id: string;
  ownerId: string;
  folderId: string | null;
  name: string;
  kind: AssetKind;
  source: AssetSource;
  sourceId?: string;
  /** 是否展示在用户的全局资产库；生成中的项目/会话产物默认不进入资产库。 */
  inLibrary?: boolean;
  versions: AssetVersion[];
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CanvasDocument {
  id: string;
  name: string;
  nodes: unknown[];
  edges: unknown[];
  viewport: { x: number; y: number; zoom: number };
  updatedAt: string;
}

export interface CanvasProject {
  id: string;
  ownerId: string;
  name: string;
  folderId?: string | null;
  coverUrl?: string | null;
  deletedAt?: string;
  canvases: CanvasDocument[];
  createdAt: string;
  updatedAt: string;
}

export interface ProjectFolder {
  id: string;
  ownerId: string;
  name: string;
  createdAt: string;
}

export interface AgentMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  assetRefs: AssetRef[];
  createdAt: string;
}

export interface AgentConversation {
  id: string;
  ownerId: string;
  title: string;
  archived: boolean;
  projectId?: string;
  messages: AgentMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface MarketEntry {
  id: string;
  ownerId: string | null;
  type: "skill";
  title: string;
  description: string;
  content: string;
  inputHint: string;
  outputKind: AssetKind;
  visibility: "official" | "private";
  version: number;
  createdAt: string;
  updatedAt: string;
}

export type WorkflowField = {
  id: string;
  label: string;
  type: "text" | "textarea" | "number" | "select" | "asset";
  required: boolean;
  options?: string[];
};

export type WorkflowStage = {
  id: string;
  title: string;
  instruction: string;
  outputKind: AssetKind;
  visibility: "hidden" | "summary" | "preview" | "review";
};

export interface WorkflowDefinition {
  id: string;
  ownerId: string | null;
  title: string;
  description: string;
  category: string;
  version: number;
  status: "draft" | "published";
  fields: WorkflowField[];
  stages: WorkflowStage[];
  graph?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export type WorkflowStageRun = {
  stageId: string;
  status: "pending" | "waiting" | "approved" | "completed" | "cancelled";
  attempts: number;
  assetRefs: AssetRef[];
};

export interface WorkflowRunRecord {
  id: string;
  ownerId: string;
  workflowId: string;
  workflowVersion: number;
  /** 运行创建时冻结的定义；后续编辑不会改变在途运行。 */
  definitionSnapshot?: Pick<WorkflowDefinition, "title" | "description" | "fields" | "stages" | "version">;
  projectId?: string;
  inputs: Record<string, string>;
  status: "running" | "awaiting_review" | "succeeded" | "cancelled" | "failed";
  stages: WorkflowStageRun[];
  currentStage: number;
  createdAt: string;
  updatedAt: string;
}
