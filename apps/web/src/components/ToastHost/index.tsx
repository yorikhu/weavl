"use client";

import { useToastStream } from "@/hooks/useToast";

import styles from "./index.module.scss";

/** 全局 toast 渲染宿主——挂在根 layout 里，每页都会自动有 */
export function ToastHost() {
  const items = useToastStream();

  if (items.length === 0) return null;

  return (
    <div className={styles.host} role="region" aria-label="通知">
      {items.map((toast) => (
        <div key={toast.id} className={styles.toast} role="status">
          {toast.text}
        </div>
      ))}
    </div>
  );
}
