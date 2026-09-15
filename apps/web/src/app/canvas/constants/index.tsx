import { Image, Type, Video } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { BasicNodeKind, CardField, NodeKind } from "../types/nodes";

export type { NodeKind };

/** 基础节点入口统一配置，画布菜单、连线菜单与节点库复用。 */
export const BASIC_NODE_CHOICES: { kind: BasicNodeKind; label: string; hint: string; icon: LucideIcon }[] = [
  { kind: "text", label: "文本", hint: "记录想法 / 说明", icon: Type },
  { kind: "image", label: "图片", hint: "上传或生成", icon: Image },
  { kind: "video", label: "视频", hint: "上传或生成", icon: Video },
];

/** 节点库（4 个能力）— 右下角或工具栏点击展开 */
export type NodeLibraryItem =
  | { kind: "llm"; title: string; meta: string; nodeKind: "card"; fields: CardField[]; category: string }
  | {
      kind: "image";
      title: string;
      meta: string;
      nodeKind: "image";
      tint: string;
      size?: { w: number; h: number };
      category: string;
    }
  | {
      kind: "video";
      title: string;
      meta: string;
      nodeKind: "image";
      tint: string;
      size?: { w: number; h: number };
      category: string;
    };

export const NODE_LIBRARY: NodeLibraryItem[] = [
  {
    kind: "llm",
    title: "故事脚本生成",
    meta: "LLM · 60-90秒",
    nodeKind: "card",
    category: "脚本",
    fields: [
      { label: "类型", value: "古风/穿越" },
      { label: "时长建议", value: "60-90秒" },
      { label: "基调", value: "热血×盛唐传奇感" },
      { label: "【字幕】", value: "对话+氛围" },
    ],
  },
  {
    kind: "image",
    title: "角色三视图",
    meta: "图像 · 形象锁定",
    nodeKind: "image",
    category: "多角度",
    tint: "rgba(212, 83, 126, 0.20)",
    size: { w: 280, h: 180 },
  },
  {
    kind: "image",
    title: "封面方案",
    meta: "图像 · 3:4",
    nodeKind: "image",
    category: "封面",
    tint: "rgba(212, 83, 126, 0.18)",
    size: { w: 200, h: 260 },
  },
  {
    kind: "video",
    title: "全能参考生视频",
    meta: "视频 · 30s",
    nodeKind: "image",
    category: "成片",
    tint: "rgba(55, 138, 221, 0.20)",
    size: { w: 320, h: 180 },
  },
];

/** 工作流阶段标题（最近任务自动铺时用） */
export const STAGE_TITLES: Record<string, string> = {
  topics: "选题生成",
  copywriting: "文案生成",
  "cover-concept": "封面方案",
  cover: "封面生成",
  check: "质量检查",
  package: "内容包",
};
