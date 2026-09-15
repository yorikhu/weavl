import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { Edge, Node } from "@xyflow/react";

interface CanvasSnapshot {
  nodes: Node[];
  edges: Edge[];
  signature: string;
}

function createSnapshot(nodes: Node[], edges: Edge[]): CanvasSnapshot {
  const stableNodes = nodes.map((node) => {
    const stable = { ...node };
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
  return {
    nodes: structuredClone(stableNodes),
    edges: structuredClone(stableEdges),
    signature: JSON.stringify({ nodes: stableNodes, edges: stableEdges }),
  };
}

/** 记录画布节点与连线历史，连续拖动会合并为一次操作。 */
export function useCanvasHistory(
  nodes: Node[],
  edges: Edge[],
  setNodes: Dispatch<SetStateAction<Node[]>>,
  setEdges: Dispatch<SetStateAction<Edge[]>>,
  ready: boolean,
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

  useEffect(() => {
    if (!ready) return;
    const next = createSnapshot(nodes, edges);
    if (!currentRef.current) {
      currentRef.current = next;
      return;
    }
    if (applyingRef.current) {
      applyingRef.current = false;
      currentRef.current = next;
      return;
    }
    if (next.signature === currentRef.current.signature) {
      updateAvailability();
      return;
    }

    setAvailability({ canUndo: true, canRedo: false });
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      const current = currentRef.current;
      if (!current || current.signature === next.signature) return;
      pastRef.current = [...pastRef.current.slice(-49), current];
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
      pastRef.current = [...pastRef.current.slice(-49), current];
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
