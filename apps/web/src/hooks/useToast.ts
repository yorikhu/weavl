"use client";

import { useEffect, useRef, useState } from "react";

export interface ToastItem {
  id: number;
  text: string;
  kind: "info" | "success";
}

let nextId = 0;
const listeners = new Set<(t: ToastItem) => void>();
const DISPLAY_DURATION = 2200;
type ToastTimer = {
  timer: number | null;
  startedAt: number;
  remaining: number;
};

/** 全局吐一条 toast（任意组件里调，无需在 hook 内） */
export function toast(text: string, kind: ToastItem["kind"] = "info") {
  const item: ToastItem = { id: ++nextId, text, kind };
  listeners.forEach((l) => l(item));
}

/** 订阅全局 toast 队列，并提供悬停暂停计时能力。 */
export function useToastStream() {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<number, ToastTimer>());

  function dismiss(id: number) {
    setItems((current) => current.filter((item) => item.id !== id));
    timers.current.delete(id);
  }

  function startTimer(id: number, remaining: number) {
    const startedAt = Date.now();
    const timer = window.setTimeout(() => dismiss(id), remaining);
    timers.current.set(id, { timer, startedAt, remaining });
  }

  function pause(id: number) {
    const state = timers.current.get(id);
    if (!state?.timer) return;
    window.clearTimeout(state.timer);
    timers.current.set(id, {
      timer: null,
      startedAt: state.startedAt,
      remaining: Math.max(0, state.remaining - (Date.now() - state.startedAt)),
    });
  }

  function resume(id: number) {
    const state = timers.current.get(id);
    if (!state || state.timer !== null) return;
    startTimer(id, Math.max(state.remaining, 300));
  }

  useEffect(() => {
    const timerStore = timers.current;
    const handler = (t: ToastItem) => {
      setItems((prev) => [...prev, t]);
      const startedAt = Date.now();
      const timer = window.setTimeout(() => {
        setItems((current) => current.filter((item) => item.id !== t.id));
        timerStore.delete(t.id);
      }, DISPLAY_DURATION);
      timerStore.set(t.id, { timer, startedAt, remaining: DISPLAY_DURATION });
    };
    listeners.add(handler);
    return () => {
      listeners.delete(handler);
      timerStore.forEach((state) => {
        if (state.timer) window.clearTimeout(state.timer);
      });
      timerStore.clear();
    };
  }, []);

  return { items, pause, resume };
}
