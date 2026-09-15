"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Coins, Send, Sparkles } from "lucide-react";
import styles from "./index.module.scss";

export interface NodePromptModelOption {
  id: string;
  label: string;
  detail?: string;
}

interface NodePromptPanelProps {
  nodeId: string;
  prompt: string;
  placeholder: string;
  model: string;
  models: NodePromptModelOption[];
  modelMenuLabel: string;
  cost?: number | string;
  busy?: boolean;
  header?: ReactNode;
  footerMiddle?: ReactNode;
  rows?: number;
  onPromptChange: (value: string) => void;
  onModelChange: (value: string) => void;
  onModelMenuOpenChange?: (open: boolean) => void;
  onSubmit: () => void;
  onEscape: () => void;
}

/** 图片、视频与文本节点共用的提示词生成面板。 */
export function NodePromptPanel({
  nodeId,
  prompt,
  placeholder,
  model,
  models,
  modelMenuLabel,
  cost,
  busy = false,
  header,
  footerMiddle,
  rows = 3,
  onPromptChange,
  onModelChange,
  onModelMenuOpenChange,
  onSubmit,
  onEscape,
}: NodePromptPanelProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const selectedModel = models.find((item) => item.id === model) ?? models[0];

  useEffect(() => {
    const compute = () => {
      const panel = panelRef.current;
      const node = document.querySelector(`.react-flow__node[data-id="${nodeId}"]`) as HTMLElement | null;
      if (!panel || !node) return;
      const width = Math.max(360, Math.min(560, window.innerWidth * 0.4));
      const rect = node.getBoundingClientRect();
      const left = Math.max(16, Math.min(window.innerWidth - width - 16, rect.left + rect.width / 2 - width / 2));
      const top = Math.min(rect.bottom + 16, window.innerHeight - panel.offsetHeight - 16);
      panel.style.width = `${width}px`;
      panel.style.transform = `translate3d(${left}px, ${top}px, 0)`;
    };
    compute();
    let frame = 0;
    const follow = () => {
      compute();
      frame = window.requestAnimationFrame(follow);
    };
    frame = window.requestAnimationFrame(follow);
    window.addEventListener("resize", compute);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", compute);
    };
  }, [nodeId]);

  function changeModelMenu(open: boolean) {
    setModelMenuOpen(open);
    onModelMenuOpenChange?.(open);
  }

  return createPortal(
    <div
      ref={panelRef}
      data-node-prompt-panel
      className={styles.panel}
      style={{ left: 0, top: 0 }}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      {header}
      <textarea
        className={`${styles.input} nodrag`}
        value={prompt}
        rows={rows}
        placeholder={placeholder}
        onChange={(event) => onPromptChange(event.target.value)}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            onSubmit();
          }
          if (event.key === "Escape") onEscape();
        }}
      />
      <div
        className={styles.footer}
        onClick={(event) => {
          if (!(event.target as HTMLElement).closest("[data-model-control]")) changeModelMenu(false);
        }}
      >
        <div className={styles.modelWrap} data-model-control>
          <button className={styles.modelButton} onClick={() => changeModelMenu(!modelMenuOpen)}>
            <Sparkles size={11} />
            {selectedModel?.label ?? "选择模型"}
            <ChevronDown size={10} className={modelMenuOpen ? styles.chevronOpen : styles.chevron} />
          </button>
          {modelMenuOpen && (
            <div className={styles.modelMenu}>
              <div className={styles.modelMenuLabel}>{modelMenuLabel}</div>
              {models.map((item) => (
                <button
                  key={item.id}
                  className={`${styles.modelOption} ${item.id === model ? styles.modelOptionActive : ""}`}
                  onClick={() => {
                    onModelChange(item.id);
                    changeModelMenu(false);
                  }}
                >
                  <span>{item.label}</span>
                  {item.detail && <small>{item.detail}</small>}
                </button>
              ))}
            </div>
          )}
        </div>
        {footerMiddle}
        {cost !== undefined && (
          <span className={styles.cost}>
            <Coins size={10} />
            {cost}
          </span>
        )}
        <button
          className={styles.submit}
          disabled={busy || !prompt.trim()}
          title="生成"
          aria-label="生成"
          onClick={onSubmit}
        >
          <Send size={13} />
        </button>
      </div>
    </div>,
    document.body,
  );
}
