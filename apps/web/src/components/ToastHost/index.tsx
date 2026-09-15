"use client";

import { useToastStream } from "@/hooks/useToast";

import styles from "./index.module.scss";

/** 全局 toast 渲染宿主——挂在根 layout 里，每页都会自动有 */
export function ToastHost() {
  const { items, pause, resume } = useToastStream();

  if (items.length === 0) return null;

  return (
    <div className={styles.host} role="region" aria-label="通知">
      {items.map((toast) => (
        <div
          key={toast.id}
          className={`${styles.toast} ${styles[toast.kind]}`}
          role="status"
          onPointerEnter={() => pause(toast.id)}
          onPointerLeave={() => resume(toast.id)}
        >
          {toast.text}
        </div>
      ))}
    </div>
  );
}
