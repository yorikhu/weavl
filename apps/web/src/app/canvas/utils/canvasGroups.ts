import type { Node } from "@xyflow/react";
import type { AnyNodeData } from "../types/nodes";

export interface CanvasGroupBounds {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  selected: boolean;
  zIndex: number;
  members: Array<{ id: string; x: number; y: number }>;
}

export interface CanvasSelectionInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface CanvasSelectionState {
  selectedNodes: Node[];
  selectedNodeIds: string[];
  selectedNodeCount: number;
  selectedGroupId?: string;
  insets: CanvasSelectionInsets;
  actionTopInset: number;
}

export interface CanvasRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const GROUP_MEMBER_FOCUSED_CLASS = "canvas-group-member-focused";

function numberValue(...values: unknown[]): number | undefined {
  return values.find((value): value is number => typeof value === "number");
}

/** 返回节点用于画布几何计算的稳定尺寸。 */
export function getCanvasNodeSize(node: Node) {
  const data = node.data as Record<string, unknown>;
  const mediaSize = data.size as { w?: number; h?: number } | undefined;
  return {
    width: numberValue(node.measured?.width, node.width, data.width, mediaSize?.w) ?? 300,
    height: numberValue(node.measured?.height, node.height, data.height, mediaSize?.h) ?? 180,
  };
}

function hasRaisedTitle(node: Node): boolean {
  const data = node.data as unknown as AnyNodeData;
  return data.nodeKind === "text" || data.nodeKind === "image" || data.nodeKind === "video";
}

/** 组边框与首行节点之间的顶部留白；带外置标题的节点需要额外容纳标题。 */
function getGroupTopInset(nodes: Node[]): number {
  if (nodes.some(hasRaisedTitle)) return 44;
  return 28;
}

/** 将单组操作栏锚定在组边框上沿，额外间距由工具栏组件统一提供。 */
export function getCanvasGroupActionTopInset(nodes: Node[]): number {
  return getGroupTopInset(nodes);
}

function groupBounds(id: string, name: string, nodes: Node[]): CanvasGroupBounds {
  const left = Math.min(...nodes.map((node) => node.position.x));
  const top = Math.min(...nodes.map((node) => node.position.y));
  const right = Math.max(...nodes.map((node) => node.position.x + getCanvasNodeSize(node).width));
  const bottom = Math.max(...nodes.map((node) => node.position.y + getCanvasNodeSize(node).height));
  const topInset = getGroupTopInset(nodes);
  const storedLayers = nodes
    .map((node) => (node.data as Record<string, unknown>).groupZIndex)
    .filter((layer): layer is number => typeof layer === "number");
  const memberLayer = Math.max(0, ...nodes.map((node) => node.zIndex ?? 0));
  const storedGroupLayer = storedLayers.length ? Math.max(...storedLayers) : memberLayer - 1;
  /* 兼容旧数据中组框与成员共用层级的情况，确保组框始终只低于自己的成员一层。 */
  const groupLayer = Math.min(storedGroupLayer, memberLayer - 1);
  return {
    id,
    name,
    x: left - 22,
    y: top - topInset,
    width: right - left + 44,
    height: bottom - top + topInset + 22,
    selected: nodes.length > 0 && nodes.every((node) => node.selected),
    zIndex: Math.max(0, Math.floor(groupLayer)),
    members: nodes.map((node) => {
      const size = getCanvasNodeSize(node);
      return { id: node.id, x: node.position.x + size.width, y: node.position.y + size.height / 2 };
    }),
  };
}

/** 单次扫描汇总节点分组及其画布边界。 */
export function getCanvasGroupBounds(nodes: Node[]): CanvasGroupBounds[] {
  const groups = new Map<string, { name: string; nodes: Node[] }>();
  nodes.forEach((node) => {
    const data = node.data as Record<string, unknown>;
    const id = typeof data.groupId === "string" ? data.groupId : "";
    if (!id) return;
    const current = groups.get(id) ?? {
      name: typeof data.groupName === "string" && data.groupName.trim() ? data.groupName : "Group",
      nodes: [],
    };
    current.nodes.push(node);
    groups.set(id, current);
  });
  return [...groups].map(([id, group]) => groupBounds(id, group.name, group.nodes));
}

/** 判断画布坐标是否位于任意组边界内，不依赖组图层是否接收到 DOM 事件。 */
export function isPointInsideCanvasGroup(nodes: Node[], point: { x: number; y: number }): boolean {
  return getCanvasGroupBounds(nodes).some(
    (group) =>
      point.x >= group.x && point.x <= group.x + group.width && point.y >= group.y && point.y <= group.y + group.height,
  );
}

/** 加载画布时恢复分组成员不可单独选择的约束。 */
export function normalizeGroupedNodeSelection(nodes: Node[]): Node[] {
  return nodes.map((node) => {
    const grouped = typeof (node.data as Record<string, unknown>).groupId === "string";
    return { ...node, selectable: !grouped, selected: false };
  });
}

/**
 * 为当前聚焦的组内节点添加独立样式类，并清理其他节点残留的临时类。
 * 不使用 domAttributes：React Flow 复用节点内部属性时可能把同一属性同步到同组节点。
 */
export function markFocusedGroupMember(nodes: Node[], focusedNodeId: string | null): Node[] {
  return nodes.map((node) => {
    const classNames = (node.className ?? "")
      .split(/\s+/)
      .filter(Boolean)
      .filter((className) => className !== GROUP_MEMBER_FOCUSED_CLASS);
    if (node.id === focusedNodeId) classNames.push(GROUP_MEMBER_FOCUSED_CLASS);
    const className = classNames.join(" ") || undefined;
    return className === node.className ? node : { ...node, className };
  });
}

export function getNextGroupName(nodes: Node[], requestedName?: string): string {
  const explicitName = requestedName?.trim();
  if (explicitName) return explicitName;
  const names = new Set(
    nodes
      .map((node) => (node.data as Record<string, unknown>).groupName)
      .filter((name): name is string => typeof name === "string"),
  );
  let index = 1;
  while (names.has(`Group ${index}`)) index += 1;
  return `Group ${index}`;
}

export function stripNodeGroup(data: Record<string, unknown>): Record<string, unknown> {
  const next = { ...data };
  delete next.groupId;
  delete next.groupName;
  delete next.groupZIndex;
  return next;
}

export function rectIntersects(a: CanvasRect, b: CanvasRect): boolean {
  return a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top;
}

function calculateSelectionInsets(nodes: Node[], selectedNodes: Node[]): CanvasSelectionInsets {
  if (!selectedNodes.length) return { top: 10, right: 25, bottom: 18, left: 25 };
  const nodeLeft = Math.min(...selectedNodes.map((node) => node.position.x));
  const nodeTop = Math.min(...selectedNodes.map((node) => node.position.y));
  const nodeRight = Math.max(...selectedNodes.map((node) => node.position.x + getCanvasNodeSize(node).width));
  const nodeBottom = Math.max(...selectedNodes.map((node) => node.position.y + getCanvasNodeSize(node).height));
  let desired: CanvasRect = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
  const selectedGroups = getCanvasGroupBounds(nodes).filter((group) => group.selected);
  const selectedGroupIds = new Set(selectedGroups.map((group) => group.id));

  selectedNodes.forEach((node) => {
    const groupId = (node.data as Record<string, unknown>).groupId;
    if (typeof groupId === "string" && selectedGroupIds.has(groupId)) return;
    const size = getCanvasNodeSize(node);
    desired = {
      left: Math.min(desired.left, node.position.x - 25),
      top: Math.min(desired.top, node.position.y - (hasRaisedTitle(node) ? 38 : 10)),
      right: Math.max(desired.right, node.position.x + size.width + 25),
      bottom: Math.max(desired.bottom, node.position.y + size.height + 18),
    };
  });
  selectedGroups.forEach((group) => {
    desired = {
      left: Math.min(desired.left, group.x - 10),
      top: Math.min(desired.top, group.y - 35),
      right: Math.max(desired.right, group.x + group.width + 10),
      bottom: Math.max(desired.bottom, group.y + group.height + 10),
    };
  });
  return {
    top: Math.ceil(nodeTop - desired.top),
    right: Math.ceil(desired.right - nodeRight),
    bottom: Math.ceil(desired.bottom - nodeBottom),
    left: Math.ceil(nodeLeft - desired.left),
  };
}

/** 汇总页面渲染选择工具栏所需的全部派生状态。 */
export function getCanvasSelectionState(nodes: Node[]): CanvasSelectionState {
  const selectedNodes = nodes.filter((node) => node.selected);
  const selectedNodeIds = selectedNodes.map((node) => node.id);
  const firstGroupId = (selectedNodes[0]?.data as Record<string, unknown> | undefined)?.groupId;
  let members: Node[] = [];
  if (typeof firstGroupId === "string") {
    members = nodes.filter((node) => (node.data as Record<string, unknown>).groupId === firstGroupId);
  }
  const isCompleteSingleGroup =
    typeof firstGroupId === "string" &&
    selectedNodes.length === members.length &&
    selectedNodes.every((node) => (node.data as Record<string, unknown>).groupId === firstGroupId);
  const insets = calculateSelectionInsets(nodes, selectedNodes);
  return {
    selectedNodes,
    selectedNodeIds,
    selectedNodeCount: selectedNodes.length,
    selectedGroupId: isCompleteSingleGroup ? firstGroupId : undefined,
    insets,
    actionTopInset: isCompleteSingleGroup ? getCanvasGroupActionTopInset(members) : insets.top,
  };
}
