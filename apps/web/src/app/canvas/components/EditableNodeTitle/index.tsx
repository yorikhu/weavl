"use client";

import { useEffect, useRef, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import styles from "./index.module.scss";

interface EditableNodeTitleProps {
  nodeId: string;
  value?: string;
  fallback: string;
  className?: string;
}

/**
 * 渲染可行内改名的节点标题；双击标题不会触发节点编辑或画布聚焦。
 *
 * @param props - 节点标识、标题值、回退文案和可选样式类。
 * @returns 节点标题的展示态或编辑态。
 */
export function EditableNodeTitle({ nodeId, value, fallback, className }: EditableNodeTitleProps) {
  const { setNodes } = useReactFlow();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || fallback);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!editing) setDraft(value || fallback);
  }, [editing, fallback, value]);

  const commit = () => {
    if (cancelledRef.current) {
      cancelledRef.current = false;
      setEditing(false);
      setDraft(value || fallback);
      return;
    }
    const title = draft.trim() || fallback;
    setNodes((nodes) =>
      nodes.map((node) =>
        node.id === nodeId ? { ...node, data: { ...(node.data as Record<string, unknown>), title } } : node,
      ),
    );
    setDraft(title);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        className={`${styles.input} ${className ?? ""} nodrag nopan`}
        value={draft}
        autoFocus
        size={Math.max(4, Math.min(24, draft.length || fallback.length))}
        aria-label="节点名称"
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onPointerDown={(event) => event.stopPropagation()}
        onDoubleClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") {
            cancelledRef.current = true;
            event.currentTarget.blur();
          }
        }}
      />
    );
  }

  return (
    <span
      className={`${styles.label} ${className ?? ""} nodrag nopan`}
      onDoubleClick={(event) => {
        event.stopPropagation();
        setEditing(true);
      }}
    >
      {value || fallback}
    </span>
  );
}
