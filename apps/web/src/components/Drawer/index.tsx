"use client";

import { useEffect, type CSSProperties, type HTMLAttributes, type ReactNode } from "react";
import { X } from "lucide-react";
import styles from "./index.module.scss";

export interface DrawerProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  open: boolean;
  title?: ReactNode;
  header?: ReactNode;
  children: ReactNode;
  side?: "left" | "right";
  width?: number;
  onClose: () => void;
}

/** 可复用的非阻塞式工作区抽屉，支持顶部插槽、左右方向和开合过渡。 */
export function Drawer({
  open,
  title,
  header,
  children,
  side = "left",
  width = 360,
  onClose,
  className,
  ...props
}: DrawerProps) {
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.querySelector('[role="dialog"]')) onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, open]);

  return (
    <aside
      {...props}
      className={[styles.drawer, styles[side], open ? styles.open : "", className].filter(Boolean).join(" ")}
      style={{ ...props.style, "--drawer-width": `${width}px` } as CSSProperties}
      aria-hidden={!open}
      inert={!open ? true : undefined}
    >
      <div className={styles.header}>
        <div className={styles.headerSlot}>{open ? (header ?? <strong>{title}</strong>) : null}</div>
        <button type="button" className={styles.close} onClick={onClose} aria-label="收起抽屉">
          <X size={15} />
        </button>
      </div>
      <div className={styles.content}>{children}</div>
    </aside>
  );
}
