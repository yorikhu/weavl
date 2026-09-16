import type { Node } from "@xyflow/react";
import type { BasicNodeKind, ImageNodeData, TextNodeData, VideoNodeData } from "../types/nodes";
import type { NodeLibraryItem } from "../constants";
import { getNextCanvasLayer } from "./canvasGroups";

export type FlowPosition = { x: number; y: number };

let idSequence = 0;
/**
 * 生成当前页面会话内唯一的节点标识。
 *
 * @returns 带时间戳和递增序号的节点标识。
 */
export const nextNodeId = () => `n_${Date.now()}_${++idSequence}`;

type BasicNodeDefinitionMap = {
  text: { type: "text"; data: TextNodeData; connectedData: TextNodeData };
  image: { type: "image"; data: ImageNodeData; connectedData: ImageNodeData };
  video: { type: "video"; data: VideoNodeData; connectedData: VideoNodeData };
};

/** 增加基础节点时，默认数据与拖线创建数据只在这里维护。 */
const BASIC_NODE_DEFINITIONS: BasicNodeDefinitionMap = {
  text: {
    type: "text",
    data: { nodeKind: "text", title: "文本", text: "" },
    connectedData: { nodeKind: "text", title: "新文本节点", text: "双击编辑内容…" },
  },
  image: {
    type: "image",
    data: {
      nodeKind: "image",
      kind: "image",
      title: "图片",
      category: "图片",
      tint: "rgba(212, 83, 126, 0.18)",
      size: { w: 300, h: 200 },
    },
    connectedData: {
      nodeKind: "image",
      kind: "image",
      title: "图片节点",
      category: "图片",
      tint: "rgba(212, 83, 126, 0.18)",
      size: { w: 300, h: 200 },
    },
  },
  video: {
    type: "video",
    data: {
      nodeKind: "video",
      title: "视频",
      category: "视频",
      tint: "rgba(55, 138, 221, 0.20)",
      size: { w: 300, h: 200 },
    },
    connectedData: {
      nodeKind: "video",
      title: "视频节点",
      category: "视频",
      tint: "rgba(55, 138, 221, 0.20)",
      size: { w: 300, h: 200 },
    },
  },
};

const NODE_KIND_LABELS: Record<BasicNodeKind, string> = { text: "文本", image: "图片", video: "视频" };

/** 按同类节点现有最大序号生成名称，避免当前画布出现同名基础节点。 */
function nextNodeTitle(kind: BasicNodeKind, nodes: Node[]) {
  const label = NODE_KIND_LABELS[kind];
  const pattern = new RegExp(`^${label}(?:\\s*(\\d+))?$`);
  const max = nodes.reduce((current, node) => {
    const data = node.data as Record<string, unknown>;
    if (data.nodeKind !== kind || typeof data.title !== "string") return current;
    const match = data.title.match(pattern);
    if (!match) return current;
    return Math.max(current, Number(match[1] || 1));
  }, 0);
  return `${label} ${max + 1}`;
}

/**
 * 按基础节点类型创建具备默认数据、唯一名称和正确层级的 React Flow 节点。
 *
 * @param kind - 要创建的基础节点类型。
 * @param position - 节点在画布坐标系中的位置。
 * @param connected - 是否由拖线操作创建；该状态会选择对应的初始内容。
 * @param existingNodes - 当前节点集合，用于生成名称和顶层层级。
 * @returns 可直接加入 React Flow 状态的节点。
 */
export function createBasicNode(
  kind: BasicNodeKind,
  position: FlowPosition,
  connected = false,
  existingNodes: Node[] = [],
): Node {
  const definition = BASIC_NODE_DEFINITIONS[kind];
  const data = structuredClone(connected ? definition.connectedData : definition.data) as unknown as Record<
    string,
    unknown
  >;
  data.title = nextNodeTitle(kind, existingNodes);
  return {
    id: nextNodeId(),
    type: definition.type,
    position,
    zIndex: getNextCanvasLayer(existingNodes),
    data,
  };
}

/**
 * 将节点库配置转换为可放置到画布的 React Flow 节点。
 *
 * @param item - 节点库中的能力定义。
 * @param position - 节点在画布坐标系中的位置。
 * @returns 与能力类型匹配的卡片或媒体节点。
 */
export function createLibraryNode(item: NodeLibraryItem, position: FlowPosition): Node {
  if (item.nodeKind === "card") {
    return {
      id: nextNodeId(),
      type: "card",
      position,
      data: {
        nodeKind: "card",
        kind: item.kind,
        title: item.title,
        category: item.category,
        fields: item.fields,
      },
    };
  }

  // 业务库里的图像/视频能力目前都复用 ImageNode 容器，保持既有节点形状。
  return {
    id: nextNodeId(),
    type: "image",
    position,
    data: {
      nodeKind: "image",
      kind: item.kind,
      title: item.title,
      category: item.category,
      tint: item.tint,
      size: item.size ?? { w: 240, h: 180 },
    },
  };
}
