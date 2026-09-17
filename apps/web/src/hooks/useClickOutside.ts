"use client";

import { useEffect, useRef, type RefObject } from "react";

type KeepOpenItem = RefObject<HTMLElement | null> | string;

/**
 * 点外部自动关闭：监听 window 的 capture pointerdown，
 * 当点击目标不在 keepOpen 白名单内时触发 onOutside。
 *
 * - active: 是否启用监听（弹窗打开时启用，关闭时移除监听）
 * - keepOpen: ref 列表 + 字符串选择器，命中则不关闭（弹窗本体 + 触发按钮）
 * - onOutside: 关闭回调
 *
 * 用 capture 阶段抢在画布平移/节点选择之前判断。
 * keepOpen 数组在内部用 ref 缓存以避免 deps 触发 effect 重建。
 *
 * @param active - 是否启用全局点击监听。
 * @param keepOpen - 点击后应保持打开的元素引用或选择器。
 * @param onOutside - 点击所有保留区域之外时执行的回调。
 * @returns 无返回值；Hook 负责监听器的注册和清理。
 */
export function useClickOutside(active: boolean, keepOpen: KeepOpenItem[], onOutside: () => void) {
  const keepOpenRef = useRef(keepOpen);
  keepOpenRef.current = keepOpen;
  const onOutsideRef = useRef(onOutside);
  onOutsideRef.current = onOutside;

  useEffect(() => {
    if (!active) return;
    const handler = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      for (const k of keepOpenRef.current) {
        if (typeof k === "string") {
          if (target.closest(k)) return;
        } else if (k.current && k.current.contains(target)) {
          return;
        }
      }
      onOutsideRef.current();
    };
    window.addEventListener("pointerdown", handler, true);
    return () => window.removeEventListener("pointerdown", handler, true);
  }, [active]);
}
