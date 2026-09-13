import type { Node } from "@xyflow/react";
import type { BasicNodeKind, ImageNodeData, TextNodeData, VideoNodeData } from "../types/nodes";
import type { NodeLibraryItem } from "../constants";

export type FlowPosition = { x: number; y: number };

let idSequence = 0;
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

export function createBasicNode(kind: BasicNodeKind, position: FlowPosition, connected = false): Node {
  const definition = BASIC_NODE_DEFINITIONS[kind];
  return {
    id: nextNodeId(),
    type: definition.type,
    position,
    data: structuredClone(connected ? definition.connectedData : definition.data) as unknown as Record<string, unknown>,
  };
}

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
