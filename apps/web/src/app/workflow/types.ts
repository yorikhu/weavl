/** 工作流画布核心类型（节点 / 边 / 视口 / 选中） */

/* ============================== 节点 ============================== */
/** 分组 chip：用于大模型等节点按"输入/输出/模型/技能"分组展示（参考扣子节点卡） */
export interface NodeChip {
  /** chip 文本（变量名 / 模型名 / 技能名） */
  label: string;
  /** 类型前缀（"str" / "int" / "float" / "bool"），为空表示非变量类 */
  type?: string;
  /** 是否特殊 chip（模型/技能等大字号项），用于不同渲染样式 */
  variant?: "default" | "model" | "skill";
  /** 自定义图标字符（emoji 或字符）；为空时按 variant 选用默认 */
  icon?: string;
  /** 是否显示警告标记（橙色圆点，如模型功能受限） */
  warning?: boolean;
}

/** 分组：一组相关 chip（带 label 标题，如"输入"/"输出"/"模型"/"技能"） */
export interface NodeGroup {
  label: string;
  chips: NodeChip[];
  /** 分组右侧操作（如 "+" 添加按钮） */
  trailing?: "add" | "more";
}

/** 画布上每个节点渲染所需的展示数据（来自 template.steps 或 customNodes） */
export interface NodeRow {
  id: string;
  title: string;
  kind: string;
  kindLabel: string;
  kindColor: string;
  step: number;
  /** flat 元数据行（向后兼容：fallback 渲染） */
  rows: Array<{ key: string; value: string; type: "plain" | "chip" | "chipAccent" | "chipMuted" }>;
  /** 分组 chip 渲染（推荐；存在时优先用 groups 渲染） */
  groups?: NodeGroup[];
}

/** 用户动态添加的节点（快速添加 / 节点库） */
export interface CustomNode {
  id: string;
  type: string;
  title: string;
  color: string;
  tag?: string;
}

/* ============================== 边 ============================== */
export interface FlowEdge {
  id: string;
  source: string;
  target: string;
}

/* ============================== 视口 ============================== */
export interface ViewState {
  scale: number;
  x: number;
  y: number;
}

export type InteractionMode = "mouse" | "trackpad";

/* ============================== 选中 / 拖拽 / 拉线 ============================== */
export interface Position {
  x: number;
  y: number;
}

export interface PendingEdge {
  from: string;
  /** 屏幕坐标，用于画虚线 */
  x: number;
  y: number;
}

export interface DragState {
  id: string;
  startX: number;
  startY: number;
  baseX: number;
  baseY: number;
}

/* ============================== 画布几何常量 ============================== */
export const NODE_W = 240;
export const NODE_H = 168;
export const CANVAS_W = 3600;
export const CANVAS_H = 1800;

/* ============================== 快捷键 ============================== */
/** 哪些 key 在画布上是全局快捷键 */
export const SHORTCUT_KEYS = {
  ESCAPE: "Escape",
  DELETE: "Delete",
  BACKSPACE: "Backspace",
} as const;
