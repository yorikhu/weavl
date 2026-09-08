/** 工作流画布核心类型（节点 / 边 / 视口 / 选中） */

/* ============================== 节点 ============================== */
/** 画布上每个节点渲染所需的展示数据（来自 template.steps 或 customNodes） */
export interface NodeRow {
  id: string;
  title: string;
  kind: string;
  kindLabel: string;
  kindColor: string;
  step: number;
  rows: Array<{ key: string; value: string; type: "plain" | "chip" | "chipAccent" | "chipMuted" }>;
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
export const NODE_W = 220;
export const NODE_H = 132;
export const CANVAS_W = 3600;
export const CANVAS_H = 1800;

/* ============================== 快捷键 ============================== */
/** 哪些 key 在画布上是全局快捷键 */
export const SHORTCUT_KEYS = {
  ESCAPE: "Escape",
  DELETE: "Delete",
  BACKSPACE: "Backspace",
} as const;
