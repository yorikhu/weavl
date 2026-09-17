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

/**
 * 计算高于当前全部节点和分组边框的下一层级。
 *
 * @param nodes - 当前画布节点。
 * @returns 新节点或新分组可安全使用的 z-index。
 */
export function getNextCanvasLayer(nodes: Node[]): number {
  return (
    nodes.reduce((highest, node) => {
      const groupLayer = (node.data as Record<string, unknown>).groupZIndex;
      return Math.max(highest, node.zIndex ?? 0, typeof groupLayer === "number" ? groupLayer : 0);
    }, 0) + 1
  );
}

/**
 * 获取节点用于分组、框选和定位计算的稳定尺寸。
 *
 * @param node - 要测量的 React Flow 节点。
 * @returns 节点宽高；缺少显式尺寸时使用节点类型的默认值。
 */
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

/**
 * 计算组边框与首行节点之间的顶部留白。
 *
 * @param nodes - 组内节点。
 * @returns 能容纳外置标题的顶部留白。
 */
function getGroupTopInset(nodes: Node[]): number {
  if (nodes.some(hasRaisedTitle)) return 44;
  return 28;
}

/**
 * 将单组操作栏锚定在组边框上沿。
 *
 * @param nodes - 组内节点。
 * @returns 操作栏相对组边框的顶部内缩距离。
 */
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

/**
 * 单次扫描汇总节点分组及其画布边界。
 *
 * @param nodes - 当前画布节点。
 * @returns 每个分组的名称、成员、边界、层级与批量连接锚点。
 */
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

/**
 * 判断画布坐标是否位于任意组边界内，不依赖组图层是否接收到 DOM 事件。
 *
 * @param nodes - 当前画布节点。
 * @param point - 画布坐标系中的目标点。
 * @returns 目标点是否位于任意组边界内。
 */
export function isPointInsideCanvasGroup(nodes: Node[], point: { x: number; y: number }): boolean {
  return getCanvasGroupBounds(nodes).some(
    (group) =>
      point.x >= group.x && point.x <= group.x + group.width && point.y >= group.y && point.y <= group.y + group.height,
  );
}

/**
 * 加载画布时恢复组成员的 React Flow 选择约束。
 *
 * @param nodes - 从持久化数据读取的节点集合。
 * @returns 带有规范化 selectable 与 selected 状态的节点集合。
 */
export function normalizeGroupedNodeSelection(nodes: Node[]): Node[] {
  return nodes.map((node) => {
    const grouped = typeof (node.data as Record<string, unknown>).groupId === "string";
    return { ...node, selectable: !grouped, selected: false };
  });
}

/**
 * 为当前聚焦的组内节点添加独立样式类，并清理其他节点残留的临时类。
 * 不使用 domAttributes：React Flow 复用节点内部属性时可能把同一属性同步到同组节点。
 *
 * @param nodes - 当前画布节点。
 * @param focusedNodeId - 当前聚焦的组内节点 ID。
 * @returns 仅目标节点带聚焦样式类的新节点数组。
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

/**
 * 为新分组生成不重复的名称，并优先采用有效的指定名称。
 *
 * @param nodes - 当前画布节点，用于收集已有组名。
 * @param requestedName - 调用方指定的可选组名。
 * @returns 可安全写入新分组的名称。
 */
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

/**
 * 从节点数据副本中移除全部分组字段。
 *
 * @param data - 原节点数据。
 * @returns 不再属于任何分组的新数据对象。
 */
export function stripNodeGroup(data: Record<string, unknown>): Record<string, unknown> {
  const next = { ...data };
  delete next.groupId;
  delete next.groupName;
  delete next.groupZIndex;
  return next;
}

/**
 * 连线创建的新节点继承共同源节点的分组。只有全部源节点都属于同一个组时才继承，
 * 避免临时多选跨组连接时把新节点错误收入其中一个组。
 *
 * @param node - 即将加入画布的新节点。
 * @param sourceIds - 本次批量连接的源节点 ID。
 * @param nodes - 当前画布节点。
 * @returns 根据共同来源补充分组信息后的节点。
 */
export function inheritSharedSourceGroup(node: Node, sourceIds: string[], nodes: Node[]): Node {
  const uniqueSourceIds = [...new Set(sourceIds)];
  const sourceIdSet = new Set(uniqueSourceIds);
  const sources = nodes.filter((item) => sourceIdSet.has(item.id));
  if (!sources.length || sources.length !== uniqueSourceIds.length) return node;

  const firstSource = sources[0];
  if (!firstSource) return node;
  const firstData = firstSource.data as Record<string, unknown>;
  const groupId = firstData.groupId;
  if (
    typeof groupId !== "string" ||
    !sources.every((source) => (source.data as Record<string, unknown>).groupId === groupId)
  )
    return node;

  const groupName = typeof firstData.groupName === "string" ? firstData.groupName : "Group";
  const groupZIndex =
    typeof firstData.groupZIndex === "number"
      ? firstData.groupZIndex
      : Math.max(0, ...sources.map((source) => source.zIndex ?? 1)) - 1;
  return {
    ...node,
    selectable: false,
    selected: false,
    zIndex: Math.max(1, ...sources.map((source) => source.zIndex ?? 1)),
    data: {
      ...(node.data as Record<string, unknown>),
      groupId,
      groupName,
      groupZIndex,
    },
  };
}

/**
 * 判断两个画布坐标矩形是否相交，边界接触也视为相交。
 *
 * @param a - 第一个矩形。
 * @param b - 第二个矩形。
 * @returns 两个矩形是否相交。
 */
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

/**
 * 汇总页面渲染选择工具栏所需的派生状态。
 *
 * @param nodes - 当前画布节点及其选中状态。
 * @returns 选中节点、完整单组判断和工具栏定位内边距。
 */
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
