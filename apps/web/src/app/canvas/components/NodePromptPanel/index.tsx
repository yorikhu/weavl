"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useReactFlow, useStore } from "@xyflow/react";
import { ChevronDown, Coins, Image as ImageIcon, LoaderCircle, Send, Sparkles, Video, X } from "lucide-react";
import {
  InlineComposer,
  type ComposerPart,
  type InlineComposerHandle,
} from "@/components/InlineComposer";
import { Popover } from "@/components/Popover";
import { getPromptMaterials, type PromptMaterial } from "../../utils/promptMaterials";
import type { PromptPart } from "../../types/nodes";
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
  costLoading?: boolean;
  busy?: boolean;
  header?: ReactNode;
  footerMiddle?: ReactNode;
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

/** 渲染入参素材的媒体预览；素材暂不可预览时回退到类型图标。 */
function MaterialPreview({ material, iconSize }: { material: PromptMaterial; iconSize: number }) {
  if (material.url && material.kind === "image") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={material.url} alt="" />;
  }
  if (material.url && material.kind === "video") return <video src={material.url} muted preload="metadata" />;
  return material.kind === "image" ? <ImageIcon size={iconSize} /> : <Video size={iconSize} />;
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
  costLoading = false,
  busy = false,
  header,
  footerMiddle,
  onPromptChange,
  onModelChange,
  onModelMenuOpenChange,
  onSubmit,
  onEscape,
}: NodePromptPanelProps) {
  const { setEdges, setNodes } = useReactFlow();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<InlineComposerHandle>(null);
  const renderedMaterialIdsRef = useRef(new Set<string>());
  const panelHeightRef = useRef(140);
  const anchor = useStore(selectPromptAnchor(nodeId), samePromptAnchor);
  const anchorRef = useRef(anchor);
  anchorRef.current = anchor;
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const selectedModel = models.find((item) => item.id === model) ?? models[0];
  const canvasNodes = useStore((state) => state.nodes);
  const canvasEdges = useStore((state) => state.edges);
  const materials = useMemo(
    () => getPromptMaterials(canvasNodes, canvasEdges, nodeId),
    [canvasEdges, canvasNodes, nodeId],
  );
  const mentionedIds = useMemo(() => {
    const targetNode = canvasNodes.find((item) => item.id === nodeId);
    const storedIds = (targetNode?.data as { inputMaterialNodeIds?: unknown } | undefined)?.inputMaterialNodeIds;
    return Array.isArray(storedIds) ? (storedIds as string[]) : [];
  }, [canvasNodes, nodeId]);
  const storedPromptParts = useMemo(() => {
    const targetNode = canvasNodes.find((item) => item.id === nodeId);
    const value = (targetNode?.data as { promptParts?: unknown } | undefined)?.promptParts;
    if (!Array.isArray(value)) return [];
    return value.filter((part): part is PromptPart => {
      if (!part || typeof part !== "object" || !("type" in part)) return false;
      if (part.type === "text") return "text" in part && typeof part.text === "string";
      return part.type === "asset" && "nodeId" in part && typeof part.nodeId === "string";
    });
  }, [canvasNodes, nodeId]);
  const mentionedMaterials = useMemo(
    () =>
      mentionedIds.flatMap((id) => {
        const material = materials.find((item) => item.nodeId === id);
        return material ? [material] : [];
      }),
    [materials, mentionedIds],
  );
  const filteredMaterials = useMemo(() => {
    const query = mentionQuery?.trim().toLocaleLowerCase() ?? "";
    return query ? materials.filter((material) => material.name.toLocaleLowerCase().includes(query)) : materials;
  }, [materials, mentionQuery]);

  const saveMentions = useCallback(
    (ids: string[]) => {
      const allowed = new Set(materials.map((item) => item.nodeId));
      const nextIds = [...new Set(ids)].filter((id) => allowed.has(id));
      setNodes((current) =>
        current.map((node) =>
          node.id === nodeId
            ? { ...node, data: { ...(node.data as Record<string, unknown>), inputMaterialNodeIds: nextIds } }
            : node,
        ),
      );
    },
    [materials, nodeId, setNodes],
  );

  /** 将编辑器文档持久化为只包含文字与画布节点引用的稳定结构。 */
  const savePromptParts = useCallback(
    (parts: ComposerPart[]) => {
      const nextParts: PromptPart[] = [];
      for (const part of parts) {
        if (part.type === "text") nextParts.push({ type: "text", text: part.text });
        else if (part.token.type === "asset") nextParts.push({ type: "asset", nodeId: part.token.id });
      }
      const nextIds = [...new Set(nextParts.flatMap((part) => (part.type === "asset" ? [part.nodeId] : [])))];
      setNodes((current) =>
        current.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                data: {
                  ...(node.data as Record<string, unknown>),
                  promptParts: nextParts,
                  inputMaterialNodeIds: nextIds,
                },
              }
            : node,
        ),
      );
    },
    [nodeId, setNodes],
  );

  const mentionMaterial = useCallback(
    (material: PromptMaterial) => {
      renderedMaterialIdsRef.current.add(material.nodeId);
      composerRef.current?.insertToken(
        {
          type: "asset",
          id: material.nodeId,
          label: `@${material.name}`,
          previewUrl: material.url,
          mediaKind: material.kind,
        },
        true,
        mentionQuery !== null,
      );
      saveMentions([...mentionedIds, material.nodeId]);
      setMentionQuery(null);
    },
    [mentionQuery, mentionedIds, saveMentions],
  );

  /** 断开指定入参素材与当前节点的连线，并同步清理提示词中的素材引用。 */
  const disconnectMaterial = useCallback(
    (material: PromptMaterial) => {
      setEdges((current) => current.filter((edge) => !(edge.source === material.nodeId && edge.target === nodeId)));
      renderedMaterialIdsRef.current.delete(material.nodeId);
      composerRef.current?.removeToken("asset", material.nodeId);
      setNodes((current) =>
        current.map((node) => {
          if (node.id !== nodeId) return node;
          const data = node.data as Record<string, unknown>;
          const storedIds = Array.isArray(data.inputMaterialNodeIds) ? (data.inputMaterialNodeIds as string[]) : [];
          return {
            ...node,
            data: { ...data, inputMaterialNodeIds: storedIds.filter((id) => id !== material.nodeId) },
          };
        }),
      );
    },
    [nodeId, setEdges, setNodes],
  );

  useEffect(() => {
    const desiredIds = new Set(mentionedMaterials.map((material) => material.nodeId));
    /* 等 InlineComposer 完成纯文本回填后再核对真实 DOM，避免刷新时标签被文本初始化覆盖。 */
    const frame = window.requestAnimationFrame(() => {
      if (storedPromptParts.length) {
        const byId = new Map(mentionedMaterials.map((material) => [material.nodeId, material]));
        const documentParts: ComposerPart[] = [];
        for (const part of storedPromptParts) {
          if (part.type === "text") {
            documentParts.push({ type: "text", text: part.text });
            continue;
          }
          const material = byId.get(part.nodeId);
          if (material) {
            documentParts.push({
              type: "token",
              token: {
                type: "asset",
                id: material.nodeId,
                label: `@${material.name}`,
                previewUrl: material.url,
                mediaKind: material.kind,
              },
            });
          }
        }
        renderedMaterialIdsRef.current = new Set(
          storedPromptParts.flatMap((part) => (part.type === "asset" ? [part.nodeId] : [])),
        );
        composerRef.current?.setDocument(documentParts);
        return;
      }
      for (const id of renderedMaterialIdsRef.current) {
        if (desiredIds.has(id)) continue;
        renderedMaterialIdsRef.current.delete(id);
        composerRef.current?.removeToken("asset", id);
      }
      for (const material of mentionedMaterials) {
        renderedMaterialIdsRef.current.add(material.nodeId);
        if (composerRef.current?.hasToken("asset", material.nodeId)) continue;
        composerRef.current?.insertToken(
          {
            type: "asset",
            id: material.nodeId,
            label: `@${material.name}`,
            previewUrl: material.url,
            mediaKind: material.kind,
          },
          false,
        );
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [mentionedMaterials, storedPromptParts]);

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
      {materials.length > 0 && (
        <div className={styles.materials} aria-label="入参素材">
          {materials.map((material) => (
            <Popover
              key={material.nodeId}
              mode="hover"
              side="top"
              showArrow={false}
              trigger={
                <div className={styles.materialWrap}>
                  <button
                    type="button"
                    className={`${styles.material} ${mentionedIds.includes(material.nodeId) ? styles.materialMentioned : ""}`}
                    aria-label={`引用${material.name}`}
                    onClick={() => mentionMaterial(material)}
                  >
                    <MaterialPreview material={material} iconSize={14} />
                    <span className={styles.materialKind}>
                      {material.kind === "image" ? <ImageIcon size={9} /> : <Video size={9} />}
                    </span>
                  </button>
                  <button
                    type="button"
                    className={styles.materialDisconnect}
                    aria-label={`移除${material.name}的入参连线`}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      disconnectMaterial(material);
                    }}
                  >
                    <X size={9} strokeWidth={2.2} />
                  </button>
                </div>
              }
            >
              {material.name}
            </Popover>
          ))}
        </div>
      )}
      <div className={styles.composer}>
        <InlineComposer
          ref={composerRef}
          className={`${styles.inlineInput} nodrag`}
          value={prompt}
          placeholder={placeholder}
          ariaLabel={placeholder}
          onValueChange={onPromptChange}
          onPartsChange={savePromptParts}
          onTokenRemove={() => undefined}
          onTokenRestore={() => undefined}
          onMentionQueryChange={(query) => setMentionQuery(materials.length ? query : null)}
          preventSubmit={mentionQuery !== null}
          onSubmit={onSubmit}
          onEscape={() => {
            if (mentionQuery !== null) setMentionQuery(null);
            else onEscape();
          }}
        />
        {mentionQuery !== null && (
          <div className={styles.mentionMenu}>
            <span>引用入参素材</span>
            {filteredMaterials.length ? (
              filteredMaterials.map((material) => (
                <button key={material.nodeId} type="button" onClick={() => mentionMaterial(material)}>
                  <span className={styles.mentionMenuPreview}>
                    <MaterialPreview material={material} iconSize={11} />
                  </span>
                  <span>{material.name}</span>
                </button>
              ))
            ) : (
              <small>没有匹配的入参素材</small>
            )}
          </div>
        )}
      </div>
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
        {(cost !== undefined || costLoading) && (
          <span className={styles.cost} aria-live="polite" aria-label={costLoading ? "正在计算积分" : undefined}>
            <Coins size={10} />
            {costLoading ? <LoaderCircle size={10} className={styles.costLoadingIcon} /> : cost}
          </span>
        )}
        <button
          className={styles.submit}
          disabled={busy || !prompt.trim()}
          title={busy ? "生成中" : "生成"}
          aria-label={busy ? "生成中" : "生成"}
          onClick={onSubmit}
        >
          {busy ? <LoaderCircle size={13} className={styles.loadingIcon} /> : <Send size={13} />}
        </button>
      </div>
    </div>,
    document.body,
  );
}
