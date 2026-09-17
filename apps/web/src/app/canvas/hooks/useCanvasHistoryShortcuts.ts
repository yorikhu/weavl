"use client";

import { useEffect, useRef } from "react";
import { isTextEditingTarget } from "../utils/canvasEvents";

/**
 * 为画布历史记录绑定跨平台撤销快捷键。
 *
 * Command/Ctrl + Z 只在非文本编辑区域触发画布撤销，避免覆盖输入框、标题和提示词编辑器的原生撤销。
 *
 * @param onUndo - 执行一次画布撤销的方法。
 * @param enabled - 当前画布是否已经完成初始化。
 */
export function useCanvasHistoryShortcuts(onUndo: () => void, enabled = true) {
  const undoRef = useRef(onUndo);
  undoRef.current = onUndo;

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const isUndo =
        (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "z";
      if (!isUndo || event.defaultPrevented || isTextEditingTarget(event.target)) return;
      event.preventDefault();
      undoRef.current();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled]);
}
