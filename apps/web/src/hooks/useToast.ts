"use client";

import { useCallback, useEffect, useState } from "react";

export interface ToastItem {
  id: number;
  text: string;
  kind: "info" | "success";
}

let nextId = 0;
const listeners = new Set<(t: ToastItem) => void>();

/** 全局吐一条 toast（任意组件里调，无需在 hook 内） */
export function toast(text: string, kind: ToastItem["kind"] = "info") {
  const item: ToastItem = { id: ++nextId, text, kind };
  listeners.forEach((l) => l(item));
}

/** 订阅全局 toast 队列（在 ToastHost 挂载时调用） */
export function useToastStream(): ToastItem[] {
  const [items, setItems] = useState<ToastItem[]>([]);
  useEffect(() => {
    const handler = (t: ToastItem) => {
      setItems((prev) => [...prev, t]);
      window.setTimeout(() => {
        setItems((prev) => prev.filter((x) => x.id !== t.id));
      }, 2200);
    };
    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  }, []);
  return items;
}
