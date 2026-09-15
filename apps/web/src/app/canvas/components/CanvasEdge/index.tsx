"use client";

import { useCallback, useRef, useState } from "react";
import { BaseEdge, EdgeLabelRenderer, getBezierPath, useReactFlow, type EdgeProps } from "@xyflow/react";
import { Scissors } from "lucide-react";
import styles from "./index.module.scss";

/**
 * 渲染带悬停断开按钮的贝塞尔画布连线。
 *
 * @param props - React Flow 注入的连线标识、端点坐标和位置。
 * @returns 可通过剪刀按钮删除的自定义连线。
 */
export function CanvasEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  style,
  interactionWidth,
}: EdgeProps) {
  const { setEdges } = useReactFlow();
  const [hovered, setHovered] = useState(false);
  const leaveTimerRef = useRef<number | null>(null);
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const cancelLeave = useCallback(() => {
    if (leaveTimerRef.current === null) return;
    window.clearTimeout(leaveTimerRef.current);
    leaveTimerRef.current = null;
  }, []);

  const showCutAction = useCallback(() => {
    cancelLeave();
    setHovered(true);
  }, [cancelLeave]);

  const hideCutAction = useCallback(() => {
    cancelLeave();
    leaveTimerRef.current = window.setTimeout(() => setHovered(false), 80);
  }, [cancelLeave]);

  const removeEdge = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      cancelLeave();
      setEdges((current) => current.filter((edge) => edge.id !== id));
    },
    [cancelLeave, id, setEdges],
  );

  return (
    <>
      <g onPointerEnter={showCutAction} onPointerLeave={hideCutAction}>
        <BaseEdge id={id} path={path} markerEnd={markerEnd} style={style} interactionWidth={interactionWidth} />
      </g>
      <EdgeLabelRenderer>
        <button
          type="button"
          className={`${styles.cutButton} ${hovered ? styles.visible : ""} nodrag nopan nowheel`}
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          aria-label="断开连线"
          tabIndex={hovered ? 0 : -1}
          onPointerEnter={showCutAction}
          onPointerLeave={hideCutAction}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={removeEdge}
        >
          <Scissors size={12} strokeWidth={1.8} />
        </button>
      </EdgeLabelRenderer>
    </>
  );
}

/** React Flow 的稳定 Edge 注册表，避免页面渲染时反复创建对象。 */
export const edgeTypes = { default: CanvasEdge };
