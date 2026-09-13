import type { Node } from "@xyflow/react";
import type { AnyNodeData, NodeKind } from "../types/nodes";

/** 不依赖 UI 的节点分类，供工具栏和选框一致使用。 */
export function getNodeToolbarKind(node: Node | null): NodeKind {
  const data = node?.data as unknown as AnyNodeData | undefined;
  if (!data) return "llm";
  if ("kind" in data && data.kind) return data.kind;
  if (data.nodeKind === "video") return "video";
  return "llm";
}

export function selectionIncludesRaisedTitle(nodes: Node[]): boolean {
  return nodes.some((node) => {
    if (!node.selected) return false;
    const data = node.data as unknown as AnyNodeData;
    return data.nodeKind === "text" || data.nodeKind === "image" || data.nodeKind === "video";
  });
}
