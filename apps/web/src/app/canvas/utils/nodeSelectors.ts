import type { Node } from "@xyflow/react";
import type { AnyNodeData } from "../types/nodes";

export function selectionIncludesRaisedTitle(nodes: Node[]): boolean {
  return nodes.some((node) => {
    if (!node.selected) return false;
    const data = node.data as unknown as AnyNodeData;
    return data.nodeKind === "text" || data.nodeKind === "image" || data.nodeKind === "video";
  });
}
