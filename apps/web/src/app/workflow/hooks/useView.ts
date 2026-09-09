"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { InteractionMode, ViewState } from "../types";
import { CANVAS_H, CANVAS_W } from "../types";

/**
 * 画布视口：scale + pan
 * - 鼠标模式：wheel = 缩放（光标为锚点）；拖动 = 平移
 * - 触控板模式：wheel = 平移（deltaX/deltaY）；ctrl+wheel = 捏合缩放
 */
export function useView(initial: ViewState = { scale: 0.55, x: 60, y: 20 }) {
  const [view, setView] = useState<ViewState>(initial);
  const viewRef = useRef(view);
  viewRef.current = view;
  const panRef = useRef({ active: false, startX: 0, startY: 0, baseX: 0, baseY: 0 });

  const setScale = useCallback((percent: number) => {
    setView((v) => ({ ...v, scale: percent / 100 }));
  }, []);

  /** 缩放到指定因子，光标 (cx, cy) 为锚点 */
  const zoomAt = useCallback((factor: number, cx: number, cy: number) => {
    setView((v) => {
      const next = Math.max(0.2, Math.min(3, v.scale * factor));
      const k = next / v.scale;
      return { scale: next, x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k };
    });
  }, []);

  /** 重置视口 */
  const resetView = useCallback(() => {
    setView({ scale: 1, x: 0, y: 0 });
  }, []);

  /** 滚轮事件（原生 non-passive，避免浏览器整页缩放） */
  const bindWheel = useCallback(
    (el: HTMLElement | null, mode: InteractionMode) => {
      if (!el) return () => {};
      const handler = (e: globalThis.WheelEvent) => {
        e.preventDefault();
        const rect = el.getBoundingClientRect();
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;
        if (mode === "mouse") {
          zoomAt(e.deltaY < 0 ? 1.08 : 1 / 1.08, cx, cy);
        } else if (e.ctrlKey || e.metaKey) {
          zoomAt(e.deltaY < 0 ? 1.02 : 1 / 1.02, cx, cy);
        } else {
          setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
        }
      };
      el.addEventListener("wheel", handler, { passive: false });
      return () => el.removeEventListener("wheel", handler);
    },
    [zoomAt],
  );

  /** 全局 mousemove / mouseup：处理节点平移 */
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!panRef.current.active) return;
      setView((v) => ({
        ...v,
        x: panRef.current.baseX + (e.clientX - panRef.current.startX),
        y: panRef.current.baseY + (e.clientY - panRef.current.startY),
      }));
    };
    const onUp = () => {
      panRef.current.active = false;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  /** 启动平移（在画布 mousedown 时调用） */
  const startPan = useCallback((clientX: number, clientY: number) => {
    panRef.current = {
      active: true,
      startX: clientX,
      startY: clientY,
      baseX: viewRef.current.x,
      baseY: viewRef.current.y,
    };
  }, []);

  /** 当前画布是否处于拖动状态（供外部排除点击事件） */
  const isPanning = useCallback(() => panRef.current.active, []);

  return {
    view,
    setView,
    setScale,
    resetView,
    bindWheel,
    startPan,
    isPanning,
    /* 供 SVG 画布 transform 用的 CSS 字符串 */
    canvasTransform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
    canvasOrigin: { x: CANVAS_W, y: CANVAS_H },
  };
}
