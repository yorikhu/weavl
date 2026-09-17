"use client";

import { useEffect, useRef } from "react";
import { isTextEditingTarget } from "../utils/canvasEvents";

/**
 * 为 React Flow 无法原生选中的组内聚焦卡片补充删除快捷键。
 *
 * @param nodeId - 当前独立聚焦的组内节点标识。
 * @param onDelete - 删除节点并清理关联连线的方法。
 * @param onDeleted - 删除后清理独立聚焦态的方法。
 */
export function useCanvasNodeDeleteShortcut(
  nodeId: string | null,
  onDelete: (nodeId: string) => void,
  onDeleted: () => void,
) {
  const callbacksRef = useRef({ onDelete, onDeleted });
  callbacksRef.current = { onDelete, onDeleted };

  useEffect(() => {
    if (!nodeId) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.key !== "Backspace" && event.key !== "Delete") || isTextEditingTarget(event.target)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      callbacksRef.current.onDelete(nodeId);
      callbacksRef.current.onDeleted();
    };

    /* React Flow 会在冒泡阶段接管删除键；捕获阶段优先处理其 selected 无法表达的组内独立聚焦态。 */
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [nodeId]);
}
