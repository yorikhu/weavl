/**
 * 画布节点类型定义 — 集中维护，与 server 端 @weavl/shared 契约对齐。
 * 这里主要是 React Flow 节点 data 形状，与 shared 的 RunView/TemplateManifest 区分。
 */
import type { ReactNode } from "react";

export type NodeKind = "llm" | "image" | "video" | "output";
export type BasicNodeKind = "text" | "image" | "video";

export interface NodeKindMeta {
  badge: string;
  icon: ReactNode;
  color: { bg: string; stroke: string; text: string; soft: string };
}

export interface CardField {
  label: string;
  value: string;
}

export interface GroupableNodeData {
  groupId?: string;
  groupName?: string;
  groupZIndex?: number;
}

export interface CardNodeData extends GroupableNodeData {
  nodeKind: "card";
  kind: NodeKind;
  title: string;
  category: string;
  fields: CardField[];
  isGate?: boolean;
}

export interface ImageNodeData extends GroupableNodeData {
  nodeKind: "image";
  kind: "image" | "video";
  title: string;
  category: string;
  url?: string;
  tint: string;
  size?: { w: number; h: number };
  /** 生图指令 + 参数（编辑栏） */
  prompt?: string;
  ratio?: string;
  quality?: string;
  resolution?: string;
  generationSize?: { width: number; height: number };
  count?: number;
  model?: string;
}

export interface TextNodeData extends GroupableNodeData {
  nodeKind: "text";
  title: string;
  text: string;
  creationMode?: "manual" | "generate";
  width?: number;
  height?: number;
}

export interface VideoNodeData extends GroupableNodeData {
  nodeKind: "video";
  title: string;
  category: string;
  url?: string;
  tint: string;
  size?: { w: number; h: number };
  prompt?: string;
  ratio?: string;
  quality?: string;
  generationSize?: { width: number; height: number };
  duration?: number;
  count?: number;
  model?: string;
}

export type AnyNodeData = CardNodeData | ImageNodeData | TextNodeData | VideoNodeData;

export interface NodeSize {
  w: number;
  h: number;
}
