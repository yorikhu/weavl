import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type SetStateAction,
} from "react";
import type { Node, XYPosition } from "@xyflow/react";
import { toast } from "@/hooks/useToast";
import {
  getCanvasGroupBounds,
  getCanvasGroupActionTopInset,
  getCanvasSelectionState,
  getNextCanvasLayer,
  getNextGroupName,
  rectIntersects,
  type CanvasRect,
} from "../utils/canvasGroups";

interface UseCanvasGroupsOptions {
  nodes: Node[];
  setNodes: Dispatch<SetStateAction<Node[]>>;
  screenToFlowPosition: (position: XYPosition) => XYPosition;
  onClearSelection: () => void;
}

interface GroupNodeDrag {
  draggedId: string;
  start: XYPosition;
  positions: Map<string, XYPosition>;
}

interface GroupBackgroundDrag {
  pointerId: number;
  start: XYPosition;
  positions: Map<string, XYPosition>;
  frame: number | null;
  latest: XYPosition;
}

function groupIdOf(node: Node): string | undefined {
  const groupId = (node.data as Record<string, unknown>).groupId;
  return typeof groupId === "string" ? groupId : undefined;
}

function isGroupId(value: string | undefined): value is string {
  return typeof value === "string";
}

function nextGroupLayers(nodes: Node[]): { group: number; member: number } {
  const group = getNextCanvasLayer(nodes);
  return { group, member: group + 1 };
}

function marqueeRect(start: XYPosition, end: XYPosition): CanvasRect {
  return {
    left: Math.min(start.x, end.x),
    top: Math.min(start.y, end.y),
    right: Math.max(start.x, end.x),
    bottom: Math.max(start.y, end.y),
  };
}

function isCanvasBackgroundTarget(target: Element): boolean {
  return !target.closest(
    ".react-flow__node, .react-flow__edge, .react-flow__handle, .react-flow__selection, button, input, textarea, [contenteditable='true'], [data-group-title]",
  );
}

/**
 * 管理画布分组的数据变更、组级选择规则和整组拖动手势。
 * 组内节点仍可单独聚焦与拖动，但框选会把完整分组视为一个选择单元。
 *
 * @param props - 节点状态、坐标转换方法和清空选择回调。
 * @returns 分组边界、聚焦状态及打组、解组、拖动相关事件处理器。
 */
export function useCanvasGroups({ nodes, setNodes, screenToFlowPosition, onClearSelection }: UseCanvasGroupsOptions) {
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const nodeDragRef = useRef<GroupNodeDrag | null>(null);
  const backgroundDragRef = useRef<GroupBackgroundDrag | null>(null);
  const marqueeStartRef = useRef<XYPosition | null>(null);
  const [focusedGroupId, setFocusedGroupId] = useState<string | null>(null);
  const [focusedGroupMemberId, setFocusedGroupMemberId] = useState<string | null>(null);
  const selection = useMemo(() => getCanvasSelectionState(nodes), [nodes]);
  const focusedGroupNodes = useMemo(
    () => nodes.filter((node) => groupIdOf(node) === focusedGroupId),
    [focusedGroupId, nodes],
  );
  const focusedGroupMemberActive = useMemo(
    () =>
      Boolean(
        focusedGroupMemberId && nodes.some((node) => node.id === focusedGroupMemberId && Boolean(groupIdOf(node))),
      ),
    [focusedGroupMemberId, nodes],
  );

  const groupNodes = useCallback(
    (nodeIds: string[], requestedName?: string) => {
      const groupId = `group_${Date.now()}`;
      const groupName = getNextGroupName(nodesRef.current, requestedName);
      const groupedIds = new Set(nodeIds);
      setNodes((current) => {
        const layers = nextGroupLayers(current);
        return current.map((node) => {
          if (!groupedIds.has(node.id)) return { ...node, selected: false };
          return {
            ...node,
            zIndex: layers.member,
            selectable: false,
            selected: false,
            data: {
              ...(node.data as Record<string, unknown>),
              groupId,
              groupName,
              groupZIndex: layers.group,
            },
          };
        });
      });
      setFocusedGroupId(null);
      setFocusedGroupMemberId(null);
      onClearSelection();
      toast(`已建立分组“${groupName}”`, "success");
    },
    [onClearSelection, setNodes],
  );

  const renameGroup = useCallback(
    (groupId: string, name: string) => {
      setNodes((current) =>
        current.map((node) => {
          const data = node.data as Record<string, unknown>;
          return data.groupId === groupId ? { ...node, data: { ...data, groupName: name } } : node;
        }),
      );
    },
    [setNodes],
  );

  const ungroupNodes = useCallback(
    (groupId: string) => {
      setNodes((current) =>
        current.map((node) => {
          const data = node.data as Record<string, unknown>;
          if (data.groupId !== groupId) return { ...node, selected: false };
          const nextData = { ...data };
          delete nextData.groupId;
          delete nextData.groupName;
          delete nextData.groupZIndex;
          return { ...node, data: nextData, selectable: true, selected: false };
        }),
      );
      setFocusedGroupId(null);
      setFocusedGroupMemberId(null);
      onClearSelection();
      toast("已解散分组", "success");
    },
    [onClearSelection, setNodes],
  );

  const startMarqueeSelection = useCallback(
    (event: ReactMouseEvent) => {
      setFocusedGroupId(null);
      setFocusedGroupMemberId(null);
      marqueeStartRef.current = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    },
    [screenToFlowPosition],
  );

  const completeMarqueeSelection = useCallback(
    (event: ReactMouseEvent) => {
      const start = marqueeStartRef.current;
      marqueeStartRef.current = null;
      if (!start) return;
      const end = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const selectedRect = marqueeRect(start, end);
      setNodes((current) => {
        const selectedGroupIds = new Set(
          current
            .filter((node) => node.selected)
            .map(groupIdOf)
            .filter(isGroupId),
        );
        getCanvasGroupBounds(current).forEach((group) => {
          const bounds = { left: group.x, top: group.y, right: group.x + group.width, bottom: group.y + group.height };
          if (rectIntersects(selectedRect, bounds)) selectedGroupIds.add(group.id);
        });
        if (!selectedGroupIds.size) return current;
        return current.map((node) => {
          const groupId = groupIdOf(node);
          return groupId && selectedGroupIds.has(groupId) ? { ...node, selected: true } : node;
        });
      });
    },
    [screenToFlowPosition, setNodes],
  );

  const startNodeDrag = useCallback(
    (node: Node) => {
      const groupId = groupIdOf(node);
      const members = groupId ? nodesRef.current.filter((item) => groupIdOf(item) === groupId) : [];
      const moveWholeGroup = members.length > 0 && members.every((item) => item.selected);
      const raisedIds = new Set(moveWholeGroup ? members.map((item) => item.id) : [node.id]);
      if (!groupId) {
        /* 拖拽不会补发 click，开始拖动外部节点时立即清理此前的组与成员聚焦。 */
        setFocusedGroupId(null);
        setFocusedGroupMemberId(null);
        onClearSelection();
      } else if (!moveWholeGroup) {
        /* 拖拽不会继续触发 click，因此在拖动开始时直接同步组内成员的独立聚焦态。 */
        setFocusedGroupId(null);
        setFocusedGroupMemberId(node.id);
        onClearSelection();
      } else {
        setFocusedGroupMemberId(null);
      }
      setNodes((current) => {
        const layers = nextGroupLayers(current);
        return current.map((item) => {
          if (!raisedIds.has(item.id)) return item;
          if (!moveWholeGroup) return { ...item, zIndex: layers.group };
          return {
            ...item,
            zIndex: layers.member,
            data: { ...(item.data as Record<string, unknown>), groupZIndex: layers.group },
          };
        });
      });
      if (!moveWholeGroup) {
        nodeDragRef.current = null;
        return;
      }
      nodeDragRef.current = {
        draggedId: node.id,
        start: { ...node.position },
        positions: new Map(members.map((item) => [item.id, { ...item.position }])),
      };
    },
    [onClearSelection, setNodes],
  );

  const dragNodeGroup = useCallback(
    (node: Node) => {
      const drag = nodeDragRef.current;
      if (!drag || drag.draggedId !== node.id) return;
      const offset = { x: node.position.x - drag.start.x, y: node.position.y - drag.start.y };
      setNodes((current) =>
        current.map((item) => {
          const origin = drag.positions.get(item.id);
          if (!origin || item.id === node.id) return item;
          return { ...item, position: { x: origin.x + offset.x, y: origin.y + offset.y } };
        }),
      );
    },
    [setNodes],
  );

  const stopNodeGroupDrag = useCallback(() => {
    nodeDragRef.current = null;
  }, []);

  const startBackgroundDrag = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0 || !isCanvasBackgroundTarget(event.target as Element)) return;
      const groupElement = (event.target as Element).closest<HTMLElement>("[data-canvas-group]");
      const groupId = groupElement?.dataset.canvasGroup;
      if (!groupId) return;
      const currentNodes = nodesRef.current;
      const group = getCanvasGroupBounds(currentNodes).find((item) => item.id === groupId);
      if (!group) return;
      const point = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const positions = new Map(
        currentNodes.filter((node) => groupIdOf(node) === group.id).map((node) => [node.id, { ...node.position }]),
      );
      if (!positions.size) return;
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      setNodes((current) => {
        const layers = nextGroupLayers(current);
        return current.map((node) => {
          if (!positions.has(node.id)) return { ...node, selected: false };
          return {
            ...node,
            selected: false,
            zIndex: layers.member,
            data: { ...(node.data as Record<string, unknown>), groupZIndex: layers.group },
          };
        });
      });
      setFocusedGroupId(group.id);
      setFocusedGroupMemberId(null);
      onClearSelection();
      backgroundDragRef.current = { pointerId: event.pointerId, start: point, positions, frame: null, latest: point };
    },
    [onClearSelection, screenToFlowPosition, setNodes],
  );

  const moveBackgroundDrag = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const drag = backgroundDragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      drag.latest = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      if (drag.frame !== null) return;
      drag.frame = requestAnimationFrame(() => {
        const active = backgroundDragRef.current;
        if (!active) return;
        active.frame = null;
        const offset = { x: active.latest.x - active.start.x, y: active.latest.y - active.start.y };
        setNodes((current) =>
          current.map((node) => {
            const origin = active.positions.get(node.id);
            return origin ? { ...node, position: { x: origin.x + offset.x, y: origin.y + offset.y } } : node;
          }),
        );
      });
    },
    [screenToFlowPosition, setNodes],
  );

  const stopBackgroundDrag = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const drag = backgroundDragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      if (drag.frame !== null) {
        cancelAnimationFrame(drag.frame);
        const offset = { x: drag.latest.x - drag.start.x, y: drag.latest.y - drag.start.y };
        setNodes((current) =>
          current.map((node) => {
            const origin = drag.positions.get(node.id);
            return origin ? { ...node, position: { x: origin.x + offset.x, y: origin.y + offset.y } } : node;
          }),
        );
      }
      backgroundDragRef.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId))
        event.currentTarget.releasePointerCapture(event.pointerId);
    },
    [setNodes],
  );

  const clearFocusedGroup = useCallback(() => setFocusedGroupId(null), []);
  const clearFocusedGroupMember = useCallback(() => setFocusedGroupMemberId(null), []);

  const focusGroup = useCallback(
    (groupId: string) => {
      setNodes((current) => current.map((node) => ({ ...node, selected: false })));
      setFocusedGroupId(groupId);
      setFocusedGroupMemberId(null);
      onClearSelection();
    },
    [onClearSelection, setNodes],
  );

  /** 组内卡片仍可单独聚焦，但不会恢复其框选能力。 */
  const focusGroupedNode = useCallback(
    (nodeId: string) => {
      const target = nodesRef.current.find((node) => node.id === nodeId);
      if (!target) return;
      const groupId = groupIdOf(target);
      if (!groupId) {
        setNodes((current) => {
          let changed = false;
          const next = current.map((node) => {
            const selected = node.id === nodeId;
            if (node.selected === selected) return node;
            changed = true;
            return { ...node, selected };
          });
          return changed ? next : current;
        });
        setFocusedGroupId(null);
        setFocusedGroupMemberId(null);
        return;
      }
      /* 成员聚焦与 React Flow 的整组选中互斥，避免一个成员触发整组白边。 */
      setNodes((current) => {
        if (!current.some((node) => node.selected)) return current;
        return current.map((node) => (node.selected ? { ...node, selected: false } : node));
      });
      setFocusedGroupId(null);
      setFocusedGroupMemberId(nodeId);
      onClearSelection();
    },
    [onClearSelection, setNodes],
  );

  return {
    selection,
    focusedGroupId,
    focusedGroupMemberId: focusedGroupMemberActive ? focusedGroupMemberId : null,
    focusedGroupNodeIds: focusedGroupNodes.map((node) => node.id),
    focusedGroupActionTopInset: getCanvasGroupActionTopInset(focusedGroupNodes),
    clearFocusedGroup,
    clearFocusedGroupMember,
    focusGroup,
    focusGroupedNode,
    groupNodes,
    renameGroup,
    ungroupNodes,
    startMarqueeSelection,
    completeMarqueeSelection,
    startNodeDrag,
    dragNodeGroup,
    stopNodeGroupDrag,
    startBackgroundDrag,
    moveBackgroundDrag,
    stopBackgroundDrag,
    isBackgroundDragging: () => Boolean(backgroundDragRef.current),
  };
}
