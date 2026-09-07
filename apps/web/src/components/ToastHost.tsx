"use client";

import { useToastStream } from "@/hooks/useToast";

/** 全局 toast 渲染宿主——挂在根 layout 里，每页都会自动有 */
export function ToastHost() {
  const items = useToastStream();
  if (items.length === 0) return null;
  return (
    <div
      style={{
        position: "fixed",
        top: 60,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        pointerEvents: "none",
      }}
    >
      {items.map((t) => (
        <div
          key={t.id}
          style={{
            padding: "8px 14px",
            background: "rgba(22, 22, 24, 0.96)",
            border: "0.5px solid #2d2d33",
            borderRadius: 10,
            color: "#e6e8ec",
            fontSize: 12,
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.45)",
            animation: "toastIn 0.18s ease",
            backdropFilter: "blur(8px)",
          }}
        >
          {t.text}
        </div>
      ))}
      <style>{`@keyframes toastIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}
