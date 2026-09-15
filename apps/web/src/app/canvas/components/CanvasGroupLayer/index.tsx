"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReactFlow, useStore, ViewportPortal, type Node } from "@xyflow/react";
import {
  getCanvasGroupBounds,
  getCanvasNodeSize,
  type CanvasGroupBounds,
  type CanvasSelectionInsets,
} from "../../utils/canvasGroups";
import { useBatchHandleMagnet } from "./useBatchHandleMagnet";
import styles from "./index.module.scss";

interface CanvasGroupLayerProps {
  focusedGroupId: string | null;
  selectedNodeIds: string[];
  selectedGroupId?: string;
  selectionInsets: CanvasSelectionInsets;
  pendingBatchSourceIds?: string[];
  onRenameGroup: (groupId: string, name: string) => void;
  onGroupContextMenu: (event: React.MouseEvent<HTMLDivElement>, group: CanvasGroupBounds) => void;
  onBatchConnect: (sourceIds: string[], targetId: string) => void;
  onBatchCreate: (sourceIds: string[], flowPos: { x: number; y: number }, clientPos: { x: number; y: number }) => void;
}

/** 在节点图层中绘制持久分组边界，并支持双击组名行内重命名。 */
interface BatchConnectionDrag {
  pointerId: number;
  sourceIds: string[];
  starts: Array<{ id: string; x: number; y: number }>;
  end: { x: number; y: number };
  clientStart: { x: number; y: number };
  clientEnd: { x: number; y: number };
  targetId: string | null;
}

interface BatchConnectionSource {
  sourceIds: string[];
  starts: Array<{ id: string; x: number; y: number }>;
}

function getSelectionBatchSource(
  nodes: Node[],
  selectedNodeIds: string[],
  insets: CanvasSelectionInsets,
): (BatchConnectionSource & { x: number; y: number }) | null {
  if (selectedNodeIds.length < 2) return null;
  const selectedIds = new Set(selectedNodeIds);
  const selectedNodes = nodes.filter((node) => selectedIds.has(node.id));
  if (selectedNodes.length < 2) return null;
  const top = Math.min(...selectedNodes.map((node) => node.position.y));
  const right = Math.max(...selectedNodes.map((node) => node.position.x + getCanvasNodeSize(node).width));
  const bottom = Math.max(...selectedNodes.map((node) => node.position.y + getCanvasNodeSize(node).height));
  return {
    x: right + insets.right,
    y: (top - insets.top + bottom + insets.bottom) / 2,
    sourceIds: selectedNodes.map((node) => node.id),
    starts: selectedNodes.map((node) => {
      const size = getCanvasNodeSize(node);
      return { id: node.id, x: node.position.x + size.width, y: node.position.y + size.height / 2 };
    }),
  };
}

export function CanvasGroupLayer({
  focusedGroupId,
  selectedNodeIds,
  selectedGroupId,
  selectionInsets,
  pendingBatchSourceIds,
  onRenameGroup,
  onGroupContextMenu,
  onBatchConnect,
  onBatchCreate,
}: CanvasGroupLayerProps) {
  const nodes = useStore((state) => state.nodes);
  const { screenToFlowPosition } = useReactFlow();
  const groups = useMemo(() => getCanvasGroupBounds(nodes), [nodes]);
  const selectionBatchSource = useMemo(
    () => (selectedGroupId ? null : getSelectionBatchSource(nodes, selectedNodeIds, selectionInsets)),
    [nodes, selectedGroupId, selectedNodeIds, selectionInsets],
  );
  const pendingBatchSources = useMemo(() => new Set(pendingBatchSourceIds ?? []), [pendingBatchSourceIds]);
  const [batchDrag, setBatchDrag] = useState<BatchConnectionDrag | null>(null);
  const batchDragRef = useRef<BatchConnectionDrag | null>(null);
  const batchFrameRef = useRef<number | null>(null);
  useBatchHandleMagnet({ draggingRef: batchDragRef });

  const updateBatchDrag = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      const active = batchDragRef.current;
      if (!active || active.pointerId !== event.pointerId) return;
      const sourceSet = new Set(active.sourceIds);
      const nodeUnderPointer = document
        .elementsFromPoint(event.clientX, event.clientY)
        .map((element) => element.closest<HTMLElement>(".react-flow__node")?.dataset.id)
        .find((id): id is string => Boolean(id));
      const targetId = nodeUnderPointer && !sourceSet.has(nodeUnderPointer) ? nodeUnderPointer : null;
      batchDragRef.current = {
        ...active,
        end: screenToFlowPosition({ x: event.clientX, y: event.clientY }),
        clientEnd: { x: event.clientX, y: event.clientY },
        targetId,
      };
      if (batchFrameRef.current !== null) return;
      batchFrameRef.current = requestAnimationFrame(() => {
        batchFrameRef.current = null;
        setBatchDrag(batchDragRef.current);
      });
    },
    [screenToFlowPosition],
  );

  const startBatchDrag = useCallback(
    (source: BatchConnectionSource, event: React.PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      const drag: BatchConnectionDrag = {
        pointerId: event.pointerId,
        sourceIds: source.sourceIds,
        starts: source.starts,
        end: screenToFlowPosition({ x: event.clientX, y: event.clientY }),
        clientStart: { x: event.clientX, y: event.clientY },
        clientEnd: { x: event.clientX, y: event.clientY },
        targetId: null,
      };
      batchDragRef.current = drag;
      setBatchDrag(drag);
    },
    [screenToFlowPosition],
  );

  const finishBatchDrag = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      const active = batchDragRef.current;
      if (!active || active.pointerId !== event.pointerId) return;
      if (batchFrameRef.current !== null) cancelAnimationFrame(batchFrameRef.current);
      batchFrameRef.current = null;
      const sourceSet = new Set(active.sourceIds);
      const nodeUnderPointer = document
        .elementsFromPoint(event.clientX, event.clientY)
        .map((element) => element.closest<HTMLElement>(".react-flow__node")?.dataset.id)
        .find((id): id is string => Boolean(id));
      const targetId = nodeUnderPointer && !sourceSet.has(nodeUnderPointer) ? nodeUnderPointer : null;
      const clientEnd = { x: event.clientX, y: event.clientY };
      const flowEnd = screenToFlowPosition(clientEnd);
      const moved = Math.hypot(clientEnd.x - active.clientStart.x, clientEnd.y - active.clientStart.y);
      if (event.type === "pointerup" && moved >= 4) {
        if (targetId) onBatchConnect(active.sourceIds, targetId);
        else if (!nodeUnderPointer) onBatchCreate(active.sourceIds, flowEnd, clientEnd);
      }
      batchDragRef.current = null;
      setBatchDrag(null);
      if (event.currentTarget.hasPointerCapture(event.pointerId))
        event.currentTarget.releasePointerCapture(event.pointerId);
    },
    [onBatchConnect, onBatchCreate, screenToFlowPosition],
  );

  useEffect(() => {
    if (!batchDrag?.targetId) return;
    const target = document.querySelector<HTMLElement>(`.react-flow__node[data-id="${batchDrag.targetId}"]`);
    target?.classList.add("connectable-target");
    return () => target?.classList.remove("connectable-target");
  }, [batchDrag?.targetId]);

  return (
    <ViewportPortal>
      <div className={styles.regions}>
        {groups.map((group) => (
          <GroupRegion
            key={group.id}
            group={group}
            active={focusedGroupId === group.id}
            batchHandleSuppressed={Boolean(selectionBatchSource)}
            batchConnectionPending={group.members.some((member) => pendingBatchSources.has(member.id))}
            onRename={onRenameGroup}
            onOpenContextMenu={onGroupContextMenu}
            onBatchStart={startBatchDrag}
            onBatchMove={updateBatchDrag}
            onBatchEnd={finishBatchDrag}
          />
        ))}
        {selectionBatchSource && !selectionBatchSource.sourceIds.some((nodeId) => pendingBatchSources.has(nodeId)) && (
          <div
            className={styles.selectionBatchAnchor}
            data-batch-connect-boundary
            style={{ transform: `translate(${selectionBatchSource.x}px, ${selectionBatchSource.y}px)` }}
          >
            <BatchConnectHandle
              source={selectionBatchSource}
              label="批量连接选中节点"
              onStart={startBatchDrag}
              onMove={updateBatchDrag}
              onEnd={finishBatchDrag}
            />
          </div>
        )}
      </div>
      {batchDrag && (
        <svg className={styles.batchLines} aria-hidden="true">
          {batchDrag.starts.map((start) => {
            const curve = Math.max(48, Math.abs(batchDrag.end.x - start.x) * 0.42);
            return (
              <path
                key={start.id}
                d={`M ${start.x} ${start.y} C ${start.x + curve} ${start.y}, ${batchDrag.end.x - curve} ${batchDrag.end.y}, ${batchDrag.end.x} ${batchDrag.end.y}`}
              />
            );
          })}
        </svg>
      )}
    </ViewportPortal>
  );
}

function GroupRegion({
  group,
  active,
  batchHandleSuppressed,
  batchConnectionPending,
  onRename,
  onOpenContextMenu,
  onBatchStart,
  onBatchMove,
  onBatchEnd,
}: {
  group: CanvasGroupBounds;
  active: boolean;
  batchHandleSuppressed: boolean;
  batchConnectionPending: boolean;
  onRename: (id: string, name: string) => void;
  onOpenContextMenu: (event: React.MouseEvent<HTMLDivElement>, group: CanvasGroupBounds) => void;
  onBatchStart: (source: BatchConnectionSource, event: React.PointerEvent<HTMLButtonElement>) => void;
  onBatchMove: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onBatchEnd: (event: React.PointerEvent<HTMLButtonElement>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(group.name);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!editing) setDraft(group.name);
  }, [editing, group.name]);

  const commit = () => {
    if (cancelledRef.current) {
      cancelledRef.current = false;
      setDraft(group.name);
    } else {
      const name = draft.trim() || group.name;
      onRename(group.id, name);
      setDraft(name);
    }
    setEditing(false);
  };

  return (
    <div
      data-canvas-group={group.id}
      data-batch-connect-boundary
      className={`${styles.group} ${group.selected || active ? styles.selected : ""} ${active ? styles.active : ""}`}
      style={{
        transform: `translate(${group.x}px, ${group.y}px)`,
        width: group.width,
        height: group.height,
        zIndex: group.zIndex,
      }}
      onContextMenu={(event) => onOpenContextMenu(event, group)}
    >
      {(group.selected || active) && !batchConnectionPending && !batchHandleSuppressed && (
        <BatchConnectHandle
          source={{ sourceIds: group.members.map((member) => member.id), starts: group.members }}
          label="批量连接组内节点"
          onStart={onBatchStart}
          onMove={onBatchMove}
          onEnd={onBatchEnd}
        />
      )}
      {editing ? (
        <input
          className={`${styles.titleInput} nodrag nopan`}
          data-group-title
          value={draft}
          autoFocus
          size={Math.max(5, Math.min(24, draft.length))}
          aria-label="分组名称"
          onChange={(event) => setDraft(event.target.value)}
          onPointerDown={(event) => event.stopPropagation()}
          onDoubleClick={(event) => event.stopPropagation()}
          onBlur={commit}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === "Enter") event.currentTarget.blur();
            if (event.key === "Escape") {
              cancelledRef.current = true;
              event.currentTarget.blur();
            }
          }}
        />
      ) : (
        <button
          type="button"
          className={`${styles.title} nodrag nopan`}
          data-group-title
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
          onDoubleClick={(event) => {
            event.stopPropagation();
            setEditing(true);
          }}
        >
          {group.name}
        </button>
      )}
    </div>
  );
}

function BatchConnectHandle({
  source,
  label,
  onStart,
  onMove,
  onEnd,
}: {
  source: BatchConnectionSource;
  label: string;
  onStart: (source: BatchConnectionSource, event: React.PointerEvent<HTMLButtonElement>) => void;
  onMove: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onEnd: (event: React.PointerEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      className={`${styles.batchHandle} nodrag nopan`}
      data-batch-connect-handle
      aria-label={label}
      onPointerDown={(event) => onStart(source, event)}
      onPointerMove={onMove}
      onPointerUp={onEnd}
      onPointerCancel={onEnd}
    />
  );
}
