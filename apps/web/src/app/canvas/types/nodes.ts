/**
 * 画布节点类型定义 — 集中维护，与 server 端 @weavl/shared 契约对齐。
 * 这里主要是 React Flow 节点 data 形状，与 shared 的 RunView/TemplateManifest 区分。
 */
import type { ReactNode } from "react";
import type { AssetRef } from "@weavl/shared";

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
  /** 在提示词中通过 @ 明确引用的直接上游媒体节点。 */
  inputMaterialNodeIds?: string[];
  /** 提示词中正文与素材标签的有序结构；模型请求由此编译图片编号。 */
  promptParts?: PromptPart[];
}

export type PromptPart = { type: "text"; text: string } | { type: "asset"; nodeId: string };

export type NodeGenerationStatus = "queued" | "running" | "finalizing" | "succeeded" | "failed";

/** 节点持久化的生成状态，保证 Loading、失败状态和异步任务标识随画布保存。 */
export interface GenerationTrackedNodeData {
  generationStatus?: NodeGenerationStatus;
  generationJobId?: string;
  generationError?: string;
}

export interface MediaNodeVariant {
  url: string;
  assetRef: AssetRef;
}

export type MediaNodeSource = "generator" | "upload" | "asset";

export interface CardNodeData extends GroupableNodeData {
  nodeKind: "card";
  kind: NodeKind;
  title: string;
  category: string;
  fields: CardField[];
  isGate?: boolean;
}

export interface ImageNodeData extends GroupableNodeData, GenerationTrackedNodeData {
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
  assetRef?: AssetRef;
  variants?: MediaNodeVariant[];
  mediaSource?: MediaNodeSource;
  intrinsicSize?: { width: number; height: number };
}

export interface TextNodeData extends GroupableNodeData, GenerationTrackedNodeData {
  nodeKind: "text";
  title: string;
  text: string;
  creationMode?: "manual" | "generate";
  width?: number;
  height?: number;
}

export interface VideoNodeData extends GroupableNodeData, GenerationTrackedNodeData {
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
  assetRef?: AssetRef;
  variants?: MediaNodeVariant[];
  mediaSource?: MediaNodeSource;
  intrinsicSize?: { width: number; height: number };
}

export type AnyNodeData = CardNodeData | ImageNodeData | TextNodeData | VideoNodeData;

export interface NodeSize {
  w: number;
  h: number;
}
