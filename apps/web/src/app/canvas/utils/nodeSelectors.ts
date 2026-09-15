import type { Edge, Node } from "@xyflow/react";
import type { AnyNodeData } from "../types/nodes";

/** 判断节点集合本身是否包含标题位于卡片上方的节点，不受选中状态影响。 */
export function nodesIncludeRaisedTitle(nodes: Node[]): boolean {
  return nodes.some((node) => {
    const data = node.data as unknown as AnyNodeData;
    return data.nodeKind === "text" || data.nodeKind === "image" || data.nodeKind === "video";
  });
}

/** 判断当前选区是否包含标题位于卡片上方的节点。 */
export function selectionIncludesRaisedTitle(nodes: Node[]): boolean {
  return nodesIncludeRaisedTitle(nodes.filter((node) => node.selected));
}

/** 返回正在编辑的节点类型，供编辑上下文决定面板类型。 */
export function getEditingNodeKind(nodes: Node[], editingId: string | null): string | null {
  if (!editingId) return null;
  const node = nodes.find((item) => item.id === editingId);
  const kind = (node?.data as Record<string, unknown> | undefined)?.nodeKind;
  return typeof kind === "string" ? kind : null;
}

/** 计算资产抽屉点击节点后的选中状态。 */
export function selectNodeFromAssetList(nodes: Node[], nodeId: string): Node[] {
  return nodes.map((node) => ({ ...node, selected: node.id === nodeId }));
}

/** 将旧数据中的 bezier 边迁移为 React Flow 可渲染的默认边。 */
export function normalizeLegacyEdges(edges: Edge[]): Edge[] {
  if (!edges.some((edge) => edge.type === "bezier")) return edges;
  return edges.map((edge) => {
    if (edge.type !== "bezier") return edge;
    return { ...edge, type: "default" } as Edge;
  });
}
