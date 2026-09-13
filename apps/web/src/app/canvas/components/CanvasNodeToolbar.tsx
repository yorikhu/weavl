"use client";

import type { NodeKind } from "../types/nodes";
import { NODE_TOOLBAR } from "../constants";
import styles from "../page.module.scss";

interface CanvasNodeToolbarProps {
  kind: NodeKind;
}

export function CanvasNodeToolbar({ kind }: CanvasNodeToolbarProps) {
  const items = NODE_TOOLBAR[kind] ?? NODE_TOOLBAR.llm ?? [];
  return (
    <div className={styles.nodeToolbar}>
      {items.map((item) => (
        <button key={item.label} className={styles.nodeToolbarItem}>
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  );
}
