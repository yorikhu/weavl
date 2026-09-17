import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { Edge, Node } from "@xyflow/react";

interface CanvasSnapshot {
  nodes: Node[];
  edges: Edge[];
  signature: string;
}

const HISTORY_LIMIT = 30;
const objectIds = new WeakMap<object, number>();
let nextObjectId = 1;

function objectToken(value: unknown): string {
  if (!value || typeof value !== "object") return String(value ?? "");
  let id = objectIds.get(value);
  if (!id) {
    id = nextObjectId;
    nextObjectId += 1;
    objectIds.set(value, id);
  }
  return String(id);
}

/**
 * 创建用于撤销与重做的稳定画布快照。
 * 节点数据按不可变对象共享，只为会被拖动库更新的位置创建独立副本。
 *
 * @param nodes - 当前画布节点。
 * @param edges - 当前画布连线。
 * @returns 去除瞬时交互状态后的快照及比较签名。
 */
function createSnapshot(nodes: Node[], edges: Edge[]): CanvasSnapshot {
  const stableNodes = nodes.map((node) => {
    const stable = { ...node, position: { ...node.position } };
    delete stable.selected;
    delete stable.dragging;
    delete stable.measured;
    return stable;
  });
  const stableEdges = edges.map((edge) => {
    const stable = { ...edge };
    delete stable.selected;
    return stable;
  });
  const nodeSignature = stableNodes
    .map(
      (node) =>
        `${node.id}:${node.type ?? ""}:${node.position.x},${node.position.y}:${node.width ?? ""},${node.height ?? ""}:${node.zIndex ?? ""}:${node.className ?? ""}:${node.selectable ?? ""}:${node.hidden ?? ""}:${objectToken(node.data)}:${objectToken(node.style)}`,
    )
    .join("|");
  const edgeSignature = stableEdges
    .map(
      (edge) =>
        `${edge.id}:${edge.source}:${edge.sourceHandle ?? ""}:${edge.target}:${edge.targetHandle ?? ""}:${edge.type ?? ""}:${edge.className ?? ""}:${edge.animated ?? ""}:${edge.hidden ?? ""}:${objectToken(edge.data)}:${objectToken(edge.style)}`,
    )
    .join("|");
  return {
    nodes: stableNodes,
    edges: stableEdges,
    signature: `${nodeSignature}#${edgeSignature}`,
  };
}

/**
 * 记录画布节点与连线历史，并将连续拖动合并为一次可撤销操作。
 * 历史记录按画布隔离，切换画布时会清空旧文档的撤销栈。
 *
 * @param nodes - 当前节点快照。
 * @param edges - 当前连线快照。
 * @param setNodes - 节点状态更新器。
 * @param setEdges - 连线状态更新器。
 * @param ready - 是否开始记录历史。
 * @param scopeKey - 用于隔离不同画布历史的稳定标识。
 * @returns 撤销、重做方法及其可用状态。
 */
export function useCanvasHistory(
  nodes: Node[],
  edges: Edge[],
  setNodes: Dispatch<SetStateAction<Node[]>>,
  setEdges: Dispatch<SetStateAction<Edge[]>>,
  ready: boolean,
  scopeKey?: string | null,
) {
  const currentRef = useRef<CanvasSnapshot | null>(null);
  const pastRef = useRef<CanvasSnapshot[]>([]);
  const futureRef = useRef<CanvasSnapshot[]>([]);
  const timerRef = useRef<number | null>(null);
  const applyingRef = useRef(false);
  const [availability, setAvailability] = useState({ canUndo: false, canRedo: false });

  const updateAvailability = useCallback(() => {
    setAvailability({ canUndo: pastRef.current.length > 0, canRedo: futureRef.current.length > 0 });
  }, []);

  /* 不同画布不能共享撤销历史，同时及时释放上一画布快照持有的资源引用。 */
  useEffect(() => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    currentRef.current = null;
    pastRef.current = [];
    futureRef.current = [];
    applyingRef.current = false;
    setAvailability({ canUndo: false, canRedo: false });
  }, [scopeKey]);

  useEffect(() => {
    if (!ready) return;
    if (!currentRef.current) {
      currentRef.current = createSnapshot(nodes, edges);
      return;
    }
    if (applyingRef.current) {
      applyingRef.current = false;
      currentRef.current = createSnapshot(nodes, edges);
      return;
    }

    /* 明确跳过拖动帧，避免帧间间隔超过防抖时间时意外生成一次昂贵快照。 */
    if (nodes.some((node) => node.dragging)) {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    /*
     * React Flow 拖动节点时每帧都会生成新的 nodes。快照包含深拷贝和序列化，若在这里
     * 同步执行，会把图片、长文本等节点数据也逐帧复制。等连续变化停下后再生成快照，
     * 既能把一次拖动合并为一个历史步骤，也不会占用拖动帧的主线程时间。
     */
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      const next = createSnapshot(nodes, edges);
      const current = currentRef.current;
      if (!current || current.signature === next.signature) {
        timerRef.current = null;
        updateAvailability();
        return;
      }
      pastRef.current = [...pastRef.current.slice(-(HISTORY_LIMIT - 1)), current];
      currentRef.current = next;
      futureRef.current = [];
      updateAvailability();
      timerRef.current = null;
    }, 180);

    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [nodes, edges, ready, updateAvailability]);

  const capturePendingChange = useCallback(() => {
    const actual = createSnapshot(nodes, edges);
    const current = currentRef.current;
    if (current && current.signature !== actual.signature) {
      pastRef.current = [...pastRef.current.slice(-(HISTORY_LIMIT - 1)), current];
      currentRef.current = actual;
      futureRef.current = [];
    }
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    return actual;
  }, [nodes, edges]);

  const undo = useCallback(() => {
    const actual = capturePendingChange();
    const previous = pastRef.current.pop();
    if (!previous) return;
    futureRef.current.push(actual);
    currentRef.current = previous;
    applyingRef.current = true;
    setNodes(previous.nodes);
    setEdges(previous.edges);
    updateAvailability();
  }, [capturePendingChange, setEdges, setNodes, updateAvailability]);

  const redo = useCallback(() => {
    const current = currentRef.current;
    const next = futureRef.current.pop();
    if (!current || !next) return;
    pastRef.current.push(current);
    currentRef.current = next;
    applyingRef.current = true;
    setNodes(next.nodes);
    setEdges(next.edges);
    updateAvailability();
  }, [setEdges, setNodes, updateAvailability]);

  return { ...availability, undo, redo };
}
