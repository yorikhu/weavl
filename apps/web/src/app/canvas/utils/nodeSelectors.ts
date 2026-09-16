import type { Edge, Node } from "@xyflow/react";
import type { AnyNodeData } from "../types/nodes";

/**
 * 判断节点集合是否包含标题位于卡片上方的节点，不受选中状态影响。
 *
 * @param nodes - 待检查的节点集合。
 * @returns 是否存在文本、图片或视频节点。
 */
export function nodesIncludeRaisedTitle(nodes: Node[]): boolean {
  return nodes.some((node) => {
    const data = node.data as unknown as AnyNodeData;
    return data.nodeKind === "text" || data.nodeKind === "image" || data.nodeKind === "video";
  });
}

/**
 * 判断当前选区是否包含标题位于卡片上方的节点。
 *
 * @param nodes - 包含选中状态的节点集合。
 * @returns 选中节点中是否存在抬高标题的节点。
 */
export function selectionIncludesRaisedTitle(nodes: Node[]): boolean {
  return nodesIncludeRaisedTitle(nodes.filter((node) => node.selected));
}

/**
 * 获取正在编辑的节点类型，供编辑上下文决定面板类型。
 *
 * @param nodes - 当前画布节点。
 * @param editingId - 当前编辑节点标识。
 * @returns 节点类型；没有有效编辑节点时返回 `null`。
 */
export function getEditingNodeKind(nodes: Node[], editingId: string | null): string | null {
  if (!editingId) return null;
  const node = nodes.find((item) => item.id === editingId);
  const kind = (node?.data as Record<string, unknown> | undefined)?.nodeKind;
  return typeof kind === "string" ? kind : null;
}

/**
 * 计算资产抽屉点击节点后的单选状态。
 *
 * @param nodes - 当前画布节点。
 * @param nodeId - 要定位并选中的节点标识。
 * @returns 只选中目标节点的新节点集合。
 */
export function selectNodeFromAssetList(nodes: Node[], nodeId: string): Node[] {
  return nodes.map((node) => ({ ...node, selected: node.id === nodeId }));
}

/**
 * 将旧数据中的 bezier 边迁移为 React Flow 可渲染的默认边。
 *
 * @param edges - 从持久化数据读取的连线。
 * @returns 已规范化的连线集合；无需迁移时保留原数组引用。
 */
export function normalizeLegacyEdges(edges: Edge[]): Edge[] {
  if (!edges.some((edge) => edge.type === "bezier")) return edges;
  return edges.map((edge) => {
    if (edge.type !== "bezier") return edge;
    return { ...edge, type: "default" } as Edge;
  });
}
