"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useStore } from "@xyflow/react";
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

interface PromptAnchor {
  left: number;
  top: number;
  width: number;
  height: number;
}

function selectPromptAnchor(nodeId: string) {
  return (state: {
    transform: [number, number, number];
    nodeLookup: Map<
      string,
      {
        measured: { width?: number; height?: number };
        width?: number;
        height?: number;
        internals: {
          positionAbsolute: { x: number; y: number };
          bounds?: { width?: number | null; height?: number | null };
        };
      }
    >;
  }): PromptAnchor | null => {
    const node = state.nodeLookup.get(nodeId);
    if (!node) return null;
    const [viewportX, viewportY, zoom] = state.transform;
    return {
      left: viewportX + node.internals.positionAbsolute.x * zoom,
      top: viewportY + node.internals.positionAbsolute.y * zoom,
      width: (node.measured.width ?? node.width ?? node.internals.bounds?.width ?? 300) * zoom,
      height: (node.measured.height ?? node.height ?? node.internals.bounds?.height ?? 180) * zoom,
    };
  };
}

function samePromptAnchor(previous: PromptAnchor | null, next: PromptAnchor | null): boolean {
  if (previous === next) return true;
  if (!previous || !next) return false;
  return (
    previous.left === next.left &&
    previous.top === next.top &&
    previous.width === next.width &&
    previous.height === next.height
  );
}

/**
 * 渲染图片、视频与文本节点共用的提示词生成面板。
 * 面板优先位于节点下方，仅在视口空间不足时与节点边界发生最小重叠。
 *
 * @param props - 锚点节点、提示词状态、模型选项和面板操作回调。
 * @returns 通过 Portal 挂载到画布视口的提示词面板。
 */
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
  const panelHeightRef = useRef(140);
  const anchor = useStore(selectPromptAnchor(nodeId), samePromptAnchor);
  const anchorRef = useRef(anchor);
  anchorRef.current = anchor;
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const selectedModel = models.find((item) => item.id === model) ?? models[0];

  const positionPanel = useCallback(() => {
    const panel = panelRef.current;
    const currentAnchor = anchorRef.current;
    if (!panel || !currentAnchor) return;
    const node = document.querySelector<HTMLElement>(`.react-flow__node[data-id="${CSS.escape(nodeId)}"]`);
    const surface = node?.querySelector<HTMLElement>("[data-canvas-node-surface]");
    const surfaceRect = surface?.getBoundingClientRect();
    const visibleAnchor = surfaceRect
      ? {
          left: surfaceRect.left,
          top: surfaceRect.top,
          width: surfaceRect.width,
          height: surfaceRect.height,
        }
      : currentAnchor;
    const width = Math.max(360, Math.min(560, window.innerWidth * 0.4));
    const left = Math.max(
      16,
      Math.min(window.innerWidth - width - 16, visibleAnchor.left + visibleAnchor.width / 2 - width / 2),
    );
    const panelHeight = panelHeightRef.current;
    const gap = 16;
    const viewportInset = 16;
    const belowTop = visibleAnchor.top + visibleAnchor.height + gap;
    /* 面板永远从卡片下方出现；仅视口底部不足时才向上收回并允许覆盖卡片边界。 */
    const top = Math.max(viewportInset, Math.min(belowTop, window.innerHeight - panelHeight - viewportInset));
    panel.style.width = `${width}px`;
    panel.style.transform = `translate3d(${left}px, ${top}px, 0)`;
  }, [nodeId]);

  useLayoutEffect(positionPanel, [anchor, positionPanel]);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      panelHeightRef.current = entry.borderBoxSize[0]?.blockSize ?? entry.contentRect.height;
      positionPanel();
    });
    observer.observe(panel);
    window.addEventListener("resize", positionPanel);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", positionPanel);
    };
  }, [positionPanel]);

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
