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

/** 画布节点的行内标题；双击后可直接改名，不会触发节点编辑或画布聚焦。 */
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
