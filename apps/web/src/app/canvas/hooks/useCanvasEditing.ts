import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { getViewportForBounds, useReactFlow, useStore, type Node } from "@xyflow/react";
import type { EditCtx } from "../editContext";
import type { AssetRef } from "@weavl/shared";
import type { AnyNodeData, CardField, MediaNodeVariant } from "../types/nodes";
import toolbarStyles from "../components/FloatingToolbar/index.module.scss";
import nodeStyles from "../components/CanvasNode/index.module.scss";

const NODE_FOCUS_MAX_ZOOM = 1.5;

/**
 * 管理节点编辑态、聚焦视口和编辑缓冲区的持久化写回。
 * 编辑状态与页面菜单、节点选中和连线交互保持独立。
 *
 * @param nodes - 当前画布节点。
 * @param setNodes - React Flow 节点状态更新器。
 * @returns 编辑上下文、进入与退出编辑态的方法及当前编辑节点信息。
 */
export function useCanvasEditing(nodes: Node[], setNodes: Dispatch<SetStateAction<Node[]>>) {
  const { setViewport } = useReactFlow();
  const viewportWidth = useStore((state) => state.width);
  const viewportHeight = useStore((state) => state.height);
  const minZoom = useStore((state) => state.minZoom);
  const maxZoom = useStore((state) => state.maxZoom);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingMode, setEditingMode] = useState<"manual" | "generate">("manual");
  const [editBuffer, setEditBuffer] = useState<{ title: string; text: string }>({ title: "", text: "" });
  /* 拖动只改变节点位置；编辑操作通过 ref 读取最新节点，避免回调随每一帧位置变化。 */
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  /** contentEditable DOM 引用（让 commitEdit 能读到最新 innerText）+ IME composition 标志 */
  const editorElRef = useRef<HTMLDivElement | null>(null);
  const composingRef = useRef(false);
  /** 进入编辑：只初始化编辑数据和模式，不改变当前画布视口。 */
  const enterEdit = useCallback(
    (id: string, mode: "manual" | "generate" = "manual") => {
      const n = nodesRef.current.find((x) => x.id === id);
      if (!n) return;
      const d = n.data as Record<string, unknown>;
      if (mode === "manual" && d.nodeKind === "text" && d.creationMode !== "manual") {
        setNodes((current) =>
          current.map((node) =>
            node.id === id
              ? { ...node, data: { ...(node.data as Record<string, unknown>), creationMode: "manual" } }
              : node,
          ),
        );
      }
      const title = typeof d.title === "string" ? d.title : d.kind === "card" ? "" : "文本";
      const text =
        typeof d.text === "string"
          ? d.text
          : typeof d.url === "string"
            ? d.url
            : d.kind === "card" && Array.isArray(d.fields)
              ? (d.fields as Array<{ label: string; value: string }>).map((f) => `${f.label}：${f.value}`).join("\n")
              : "";
      setEditBuffer({ title, text });
      setEditingMode(mode);
      setEditingId(id);
    },
    [setNodes],
  );

  /** 双击聚焦：按节点实际尺寸自适应视口，保证缩放后的节点完整可见。 */
  const focusNode = useCallback(
    (id: string, options?: { leftInset?: number }) => {
      const node = nodesRef.current.find((item) => item.id === id);
      if (!node) return;
      const data = node.data as Record<string, unknown>;
      /* 文本节点保存的拖拽尺寸优先于 React Flow 可能尚未刷新的 measured。 */
      const width = typeof data.width === "number" ? data.width : (node.measured?.width ?? 440);
      const height = typeof data.height === "number" ? data.height : (node.measured?.height ?? 120);
      const leftInset = Math.max(0, options?.leftInset ?? 0);
      const viewport = getViewportForBounds(
        { x: node.position.x, y: node.position.y, width, height },
        Math.max(1, viewportWidth - leftInset),
        viewportHeight,
        minZoom,
        Math.min(maxZoom, NODE_FOCUS_MAX_ZOOM),
        0.16,
      );
      viewport.x += leftInset;
      void setViewport(viewport, { duration: 320, ease: (progress) => 1 - (1 - progress) ** 3 });
    },
    [viewportWidth, viewportHeight, minZoom, maxZoom, setViewport],
  );

  /** 退出编辑：视口保持不动（位置和缩放都不变），只关编辑态 */
  const exitEdit = useCallback(() => {
    setEditingId(null);
  }, []);

  /** 写回节点 data（节点内编辑器走这条） */
  const writeNodeData = useCallback(
    (id: string, title: string, text: string, size?: { w: number; h: number }) => {
      setNodes((ns) =>
        ns.map((n) => {
          if (n.id !== id) return n;
          const d = { ...(n.data as Record<string, unknown>) };
          if (title.trim()) d.title = title.trim();
          const kind = d.nodeKind;
          if (kind === "text") {
            d.text = text;
            if (size && size.w > 0) d.width = Math.round(size.w);
            if (size && size.h > 0) d.height = Math.round(size.h);
          } else if (kind === "card") {
            const fields: CardField[] = [];
            for (const line of text.split("\n")) {
              const m = line.match(/^(.*?)[:：]\s*(.*)$/);
              if (m && m[1]) fields.push({ label: m[1], value: m[2] ?? "" });
              else if (line.trim()) fields.push({ label: "·", value: line });
            }
            d.fields = fields;
          } else {
            const urlMatch = text.match(/https?:\/\/\S+/);
            if (urlMatch) d.url = urlMatch[0];
          }
          return { ...n, data: d as unknown as AnyNodeData } as unknown as Node;
        }),
      );
    },
    [setNodes],
  );

  /** 入口：传入 id/title/text 直接写回 */
  const saveEdit = useCallback(
    (id: string, title: string, text: string) => {
      writeNodeData(id, title, text);
      exitEdit();
    },
    [writeNodeData, exitEdit],
  );

  /** 图片编辑器实时状态 ref（编辑器组件每次状态变化时写入） */
  const imageEditStateRef = useRef<EditCtx["imageEditStateRef"]["current"]>(null);

  /** 图片节点编辑提交 —— prompt/参数/模型/图片写回节点 data */
  const commitImageEdit = useCallback(
    (
      id: string,
      payload: {
        prompt?: string;
        ratio?: string;
        quality?: string;
        resolution?: string;
        generationSize?: { width: number; height: number };
        size?: { w: number; h: number };
        count?: number;
        model?: string;
        url?: string;
        assetRef?: AssetRef;
        variants?: MediaNodeVariant[];
        generationStatus?: "succeeded";
      },
    ) => {
      setNodes((ns) =>
        ns.map((n) => {
          if (n.id !== id) return n;
          const d = { ...(n.data as Record<string, unknown>) };
          if (payload.prompt !== undefined) d.prompt = payload.prompt;
          if (payload.ratio) d.ratio = payload.ratio;
          if (payload.quality) d.quality = payload.quality;
          if (payload.resolution) d.resolution = payload.resolution;
          if (payload.generationSize) d.generationSize = payload.generationSize;
          if (payload.size) d.size = payload.size;
          if (typeof payload.count === "number") d.count = payload.count;
          if (payload.model) d.model = payload.model;
          if (payload.url !== undefined) d.url = payload.url;
          if (payload.assetRef) d.assetRef = payload.assetRef;
          if (payload.variants) d.variants = payload.variants;
          if (payload.generationStatus) {
            d.generationStatus = payload.generationStatus;
            d.generationError = undefined;
          }
          return { ...n, data: d as unknown as AnyNodeData } as unknown as Node;
        }),
      );
      exitEdit();
    },
    [setNodes, exitEdit],
  );

  /** 视频编辑器实时状态 ref（编辑器组件每次状态变化时写入） */
  const videoEditStateRef = useRef<EditCtx["videoEditStateRef"]["current"]>(null);

  /** 视频节点编辑提交 —— prompt/参数/视频写回节点 data */
  const commitVideoEdit = useCallback(
    (
      id: string,
      payload: {
        prompt?: string;
        ratio?: string;
        quality?: string;
        generationSize?: { width: number; height: number };
        size?: { w: number; h: number };
        duration?: number;
        count?: number;
        model?: string;
        url?: string;
        assetRef?: AssetRef;
        variants?: MediaNodeVariant[];
        title?: string;
        generationStatus?: "succeeded";
        generationJobId?: string;
      },
    ) => {
      setNodes((ns) =>
        ns.map((n) => {
          if (n.id !== id) return n;
          const d = { ...(n.data as Record<string, unknown>) };
          if (payload.title !== undefined && payload.title.trim()) d.title = payload.title.trim();
          if (payload.prompt !== undefined) d.prompt = payload.prompt;
          if (payload.ratio) d.ratio = payload.ratio;
          if (payload.quality) d.quality = payload.quality;
          if (payload.generationSize) d.generationSize = payload.generationSize;
          if (payload.size) d.size = payload.size;
          if (typeof payload.duration === "number") d.duration = payload.duration;
          if (typeof payload.count === "number") d.count = payload.count;
          if (payload.model) d.model = payload.model;
          if (payload.url !== undefined) d.url = payload.url;
          if (payload.assetRef) d.assetRef = payload.assetRef;
          if (payload.variants) d.variants = payload.variants;
          if (payload.generationStatus) {
            d.generationStatus = payload.generationStatus;
            d.generationError = undefined;
          }
          if (payload.generationJobId) d.generationJobId = payload.generationJobId;
          return { ...n, data: d as unknown as AnyNodeData } as unknown as Node;
        }),
      );
      exitEdit();
    },
    [setNodes, exitEdit],
  );

  /** 入口：commitEdit 直接从 contentEditable DOM 读最新 innerText（避免 React state 异步导致保存过时）
     图片节点编辑态时改走 commitImageEdit（用 imageEditStateRef 里的实时状态）
     视频节点编辑态时改走 commitVideoEdit */
  const commitEdit = useCallback(() => {
    if (!editingId) return;
    const editingNode = nodesRef.current.find((n) => n.id === editingId);
    const editingKind = (editingNode?.data as Record<string, unknown> | undefined)?.nodeKind;
    if (editingKind === "image") {
      const payload = imageEditStateRef.current;
      commitImageEdit(editingId, payload ?? {});
      return;
    }
    if (editingKind === "video") {
      const payload = videoEditStateRef.current;
      commitVideoEdit(editingId, payload ?? {});
      return;
    }
    const editor = editorElRef.current;
    const liveText = editor?.innerText ?? "";
    const finalText = composingRef.current ? editBuffer.text : liveText;
    /** 节点容器尺寸（用户在编辑态拖出来的宽/高）一并保存 */
    const container = editor?.parentElement;
    const size =
      container && container.offsetWidth > 0 && container.offsetHeight > 0
        ? { w: container.offsetWidth, h: container.offsetHeight }
        : undefined;
    writeNodeData(editingId, editBuffer.title, finalText, size);
    exitEdit();
  }, [editingId, editBuffer, writeNodeData, exitEdit, commitImageEdit, commitVideoEdit]);

  /** 工具栏格式化命令：作用于当前 contentEditable 焦点 */
  const onApplyFormat = useCallback((cmd: string, value?: string) => {
    try {
      document.execCommand(cmd, false, value);
    } catch {
      /** 浏览器不支持时静默失败 */
    }
  }, []);

  /** 编辑模式下，全局 ESC 退出（即使焦点不在节点内） */
  useEffect(() => {
    if (!editingId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        exitEdit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editingId, exitEdit]);

  /** 编辑模式下，点击编辑节点外部（画布空白处 / 页面其它区域）自动保存退出 */
  useEffect(() => {
    if (!editingId) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      /** 点在文本编辑节点内部（含标题输入框、正文、resize 句柄）→ 不处理 */
      if (target.closest("[data-canvas-text-editor]")) return;
      /** 点在图片编辑节点内部（卡片 + 底部编辑栏）→ 不处理 */
      if (target.closest(`.${nodeStyles.imageNodeEditWrap}`)) return;
      /** 节点提示词面板通过 Portal 挂到 body，点击内部不退出编辑态。 */
      if (target.closest("[data-node-prompt-panel]")) return;
      /** 提示词面板内的二级 Popover 也通过 Portal 挂载，点选规格时保持节点编辑态。 */
      if (target.closest('[data-popover-scope="node-prompt"]')) return;
      /** 点在顶部格式化工具栏上 → 不处理（工具栏按钮要保持焦点操作正文） */
      if (target.closest(`.${toolbarStyles.floatingToolbar}`)) return;
      /* 先保存当前内容，但继续传递 pointerdown，让目标节点可在同一次操作中开始拖动。 */
      commitEdit();
    };
    /** 捕获阶段先保存编辑内容，同时保留原事件供画布选择和拖动继续处理。 */
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => window.removeEventListener("pointerdown", onPointerDown, true);
  }, [editingId, commitEdit]);

  return {
    editingId,
    editingMode,
    setEditingId,
    editBuffer,
    setEditBuffer,
    editorElRef,
    composingRef,
    enterEdit,
    focusNode,
    exitEdit,
    saveEdit,
    commitEdit,
    commitImageEdit,
    commitVideoEdit,
    onApplyFormat,
    imageEditStateRef,
    videoEditStateRef,
  };
}
