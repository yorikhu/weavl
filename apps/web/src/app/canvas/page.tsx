"use client";

import React from "react";

import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useClickOutside } from "@/hooks/useClickOutside";
import { toast } from "@/hooks/useToast";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useStore,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
  Handle,
  Position,
  ReactFlowProvider,
  useReactFlow,
  ConnectionMode,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { RunView } from "@weavl/shared";
import {
  RefreshCw,
  X,
  ChevronDown,
  ChevronRight,
  Coins,
  Share2,
  User as UserIcon,
  Plus,
  Send,
  Link2,
  Layers,
  Bot,
  Maximize2,
  Image as ImageIcon,
  Video as VideoIcon,
  Music,
  Sparkles,
  CheckCircle2,
  Type as TypeIcon,
  Type as TypeGlyph,
  ImagePlus,
  Upload,
  Tag,
  Palette,
  MonitorPlay,
  SlidersHorizontal,
  Zap,
  Minus,
  Pilcrow,
  RemoveFormatting,
  Film,
  FileText,
  Volume2,
} from "lucide-react";
import styles from "./page.module.scss";
import { API } from "@/lib/env";
import { EnterEditContext } from "@/features/canvas/editContext";
import { KIND_META } from "@/features/canvas/types/kindMeta";
import type {
  AnyNodeData,
  CardField,
  CardNodeData,
  ImageNodeData,
  NodeKind,
  TextNodeData,
  VideoNodeData,
} from "@/features/canvas/types/nodes";
import { NODE_LIBRARY, NODE_TOOLBAR, STAGE_TITLES, nextNodeId } from "@/features/canvas/constants";

/* ---------------- 节点定义 ---------------- */

function CardNode({ data, selected, id }: NodeProps) {
  const edit = useContext(EnterEditContext);
  const d = data as unknown as CardNodeData;
  const meta = KIND_META[d.kind];

  if (edit.editingId === id) {
    return (
      <NodeEditor
        categoryLabel={d.category || meta.badge}
        initialTitle={d.title}
        initialText={(d.fields ?? []).map((f) => `${f.label}：${f.value}`).join("\n")}
        accentColor={meta.color.text}
        onSave={(title, text) => edit.saveEdit(id, title, text)}
        onCancel={edit.exitEdit}
      />
    );
  }

  return (
    <div
      className={`${styles.card} ${selected ? styles.cardSelected : ""}`}
      style={{ borderColor: selected ? meta.color.text : "#27272c" }}
      onDoubleClick={() => edit.enterEdit(id)}
    >
      {selected && <div className={styles.cardAccent} style={{ background: meta.color.text }} />}
      <Handle type="target" position={Position.Left} className={styles.cardHandle} />
      <div className={styles.cardHead}>
        <span className={styles.cardCategory} style={{ color: meta.color.text, background: meta.color.bg }}>
          {d.category || meta.badge}
        </span>
        <span className={styles.cardType} style={{ borderColor: meta.color.stroke, color: meta.color.text }}>
          {d.title}
        </span>
      </div>
      {d.fields?.[0]?.label !== "_title" && (
        <div className={styles.cardFields}>
          {(d.fields ?? []).slice(0, 6).map((f, i) => (
            <div key={i} className={styles.cardField}>
              <span className={styles.cardFieldLabel}>{f.label}</span>
              <span className={styles.cardFieldValue}>{f.value}</span>
            </div>
          ))}
        </div>
      )}
      <Handle type="source" position={Position.Right} className={styles.cardHandle} />
    </div>
  );
}

/* v22：图片卡片静态结构 —— 默认态与编辑态共用同一组件，保证进入编辑时卡片完全不变
   v23：editing=true 时标题变为可编辑 input（样式与静态标题一致，无框感） */
function ImageCardStatic({
  id,
  d,
  overrideUrl,
  onPickFile,
  onDoubleClick,
  editing = false,
}: {
  id: string;
  d: ImageNodeData;
  overrideUrl?: string;
  onPickFile?: (f: File | undefined) => void;
  onDoubleClick?: () => void;
  editing?: boolean;
}) {
  const edit = useContext(EnterEditContext);
  const meta = KIND_META[d.kind];
  const tint = d.tint ?? meta.color.bg;
  const w = d.size?.w ?? 300;
  const h = d.size?.h ?? 200;
  const displayTitle = d.title || "图片节点";
  const url = overrideUrl ?? d.url;
  const fileRef = useRef<HTMLInputElement | null>(null);

  /* 默认态图生图：选中文件直接写回节点 url（不进编辑态） */
  const pickAndCommit = useCallback(
    (f: File | undefined) => {
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        edit.commitImageEdit?.(id, { url: String(reader.result) });
      };
      reader.readAsDataURL(f);
    },
    [edit, id],
  );

  return (
    <>
      <div className={styles.imageNodeTitleAbove}>
        <ImageIcon size={12} />
        {editing ? (
          <input
            className={`${styles.imageNodeTitleInput} nodrag`}
            value={edit.buffer.title ?? ""}
            onChange={(e) => edit.setBuffer({ ...edit.buffer, title: e.target.value })}
            onKeyDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            placeholder="图片节点"
            spellCheck={false}
          />
        ) : (
          <span>{displayTitle}</span>
        )}
      </div>
      <div className={styles.imageNode} style={{ width: w, height: h }} onDoubleClick={onDoubleClick}>
        <Handle type="target" position={Position.Left} className={styles.cardHandle} />
        {/* 已有图则显示真图，否则占位渐变 */}
        {url ? (
          <div className={styles.imagePreview}>
            <img src={url} alt={d.title} className={styles.imageReal} />
          </div>
        ) : (
          <div
            className={styles.imagePreview}
            style={{ background: `linear-gradient(135deg, ${tint} 0%, rgba(20, 20, 22, 0.6) 100%)` }}
          >
            <div className={styles.imagePlaceholder} style={{ color: meta.color.text }}>
              {meta.icon}
            </div>
          </div>
        )}
        {/* v22：左下角双入口 chip（图生图 / 图片高清） */}
        <div className={`${styles.imageTryChips} nodrag`}>
          <button className={styles.imageTryChip} onClick={() => fileRef.current?.click()}>
            <Upload size={11} />
            图生图
          </button>
          <button className={styles.imageTryChip} title="即将上线：生成高清化工作节点">
            <ImageIcon size={11} />
            图片高清
          </button>
        </div>
        <Handle type="source" position={Position.Right} className={styles.cardHandle} />
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            (onPickFile ?? pickAndCommit)(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
    </>
  );
}

function ImageNode({ data, id }: NodeProps) {
  const edit = useContext(EnterEditContext);
  const d = data as unknown as ImageNodeData;

  if (edit.editingId === id) {
    return <ImageNodeEditor id={id} data={d} />;
  }

  return (
    <div className={styles.imageNodeWrap}>
      <ImageCardStatic id={id} d={d} onDoubleClick={() => edit.enterEdit(id)} />
    </div>
  );
}

/* ---------------- ImageEditPanel（v34）：图片节点编辑栏 —— 由 CanvasInner 用 Portal 挂到屏底，居中对齐节点 ----------------
   字段、菜单、输入、参数、发送逻辑全部从原 ImageNodeEditor 抽出；
   通过 edit.imageEditStateRef 与 edit.commitImageEdit 与外部通信（保持 commitEdit 兼容） */
function shallowEqual(a: Record<string, unknown>, b: Record<string, unknown>) {
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  for (const k of ka) if (a[k] !== b[k]) return false;
  return true;
}

function ImageEditPanel() {
  const edit = useContext(EnterEditContext);
  const rf = useStore((s) => ({ tx: s.transform[0], ty: s.transform[1], zoom: s.transform[2] }), shallowEqual);

  /* 当前编辑的图片节点（editingId）—— 字段初值取自节点的 data */
  const editingId = edit.editingId;
  const node = useStore((s) => (editingId ? (s.nodes.find((n) => n.id === editingId) ?? null) : null));
  const data = (node?.data as unknown as ImageNodeData | undefined) ?? null;
  /* v34.2：只渲染图片节点编辑栏（视频节点由 VideoEditPanel 渲染）。
     所有 hooks 必须在 early return 之前固定调用（Rules of Hooks） */
  const isImage = (data as unknown as { nodeKind?: string } | undefined)?.nodeKind === "image";

  const [prompt, setPrompt] = useState(data?.prompt ?? "");
  const [ratio, setRatio] = useState(data?.ratio ?? "1:1");
  const [quality, setQuality] = useState(data?.quality ?? "标准");
  const [count, setCount] = useState(data?.count ?? 1);
  const [model, setModel] = useState(data?.model ?? "Weavl Image");
  const [showRatioMenu, setShowRatioMenu] = useState(false);
  const [showModelMenu, setShowModelMenu] = useState(false);

  /* 节点变更（切到不同图片节点编辑）时同步字段初值 */
  useEffect(() => {
    if (!data) return;
    setPrompt(data.prompt ?? "");
    setRatio(data.ratio ?? "1:1");
    setQuality(data.quality ?? "标准");
    setCount(data.count ?? 1);
    setModel(data.model ?? "Weavl Image");
  }, [edit.editingId, data]);

  /* 实时同步到 imageEditStateRef，供外部 commitEdit / commitImageEdit 取最新值 */
  useEffect(() => {
    edit.imageEditStateRef.current = {
      prompt,
      ratio,
      quality,
      count,
      model,
      title: edit.buffer.title,
    };
  }, [prompt, ratio, quality, count, model, edit]);

  /* 发送：写入节点 data，保留编辑栏在屏上的同时更新预览（提示用户"已生成"）—— 简化：直接退出编辑态 */
  const onGenerate = useCallback(() => {
    if (!edit.editingId) return;
    edit.commitImageEdit?.(edit.editingId, {
      prompt,
      ratio,
      quality,
      count,
      model,
      title: undefined,
    });
  }, [edit, prompt, ratio, quality, count, model]);

  const ratioOptions = ["1:1", "16:9", "9:16", "4:3", "3:4"];
  const modelOptions = ["Weavl Image", "Lib Image", "SDXL", "DALL·E 3"];

  /* -------- 居中算法：拖动性能优化 --------
   v34.1 关键改进：
   - 拖动中直接写 panelRef.current.style.transform（绕开 React 重渲染，60fps 跟手）
   - 去掉了 CSS transition（拖动中 transition 200ms 是延迟的元凶）
   - 只在 editingId 变化时启用一次 200ms 过渡（切节点的视觉过渡），拖动时 transition="none"
   - rAF 内只在值真的变了时写 DOM（无变化就跳过 setStyle 写） */
  const panelRef = useRef<HTMLDivElement | null>(null);
  const lastLeftRef = useRef(-1);
  const lastTopRef = useRef(-1);
  const lastWidthRef = useRef(-1);

  useEffect(() => {
    const compute = () => {
      if (!node || typeof window === "undefined") return;
      const panelEl = panelRef.current;
      if (!panelEl) return;
      const panelW = Math.max(320, Math.min(720, window.innerWidth * 0.4));
      const panelH = panelEl.offsetHeight || 80; /* offsetHeight 强制 layout，量真实高度 */
      const el = document.querySelector(`.react-flow__node[data-id="${node.id}"]`) as HTMLElement | null;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const centerScreenX = rect.left + rect.width / 2;
      const rawLeft = centerScreenX - panelW / 2;
      const clampedLeft = Math.max(16, Math.min(window.innerWidth - panelW - 16, rawLeft));
      const rawTop = rect.bottom + 16;
      const maxTop = window.innerHeight - panelH - 16;
      const clampedTop = Math.min(rawTop, maxTop);
      /* 仅在变化时写 DOM（避免无谓 reflow） */
      if (clampedLeft !== lastLeftRef.current || clampedTop !== lastTopRef.current) {
        panelEl.style.transform = `translate3d(${clampedLeft}px, ${clampedTop}px, 0)`;
        lastLeftRef.current = clampedLeft;
        lastTopRef.current = clampedTop;
      }
      if (panelW !== lastWidthRef.current) {
        panelEl.style.width = `${panelW}px`;
        lastWidthRef.current = panelW;
      }
    };
    compute();
    const onResize = () => compute();
    window.addEventListener("resize", onResize);
    let raf = 0;
    const loop = () => {
      compute();
      raf = window.requestAnimationFrame(loop);
    };
    raf = window.requestAnimationFrame(loop);
    return () => {
      window.removeEventListener("resize", onResize);
      window.cancelAnimationFrame(raf);
    };
  }, [node, rf.tx, rf.ty, rf.zoom]);

  /* v36：去掉飞入动画 —— 始终 opacity:1，compute() 失败也不影响可见性 */
  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    el.style.opacity = "1";
  }, [edit.editingId]);

  /* v34.2：只在编辑图片节点时渲染（early return 必须在所有 hooks 之后） */
  if (!edit.editingId || !isImage) return null;

  const panelW = Math.max(320, Math.min(720, typeof window !== "undefined" ? window.innerWidth * 0.4 : 480));

  return createPortal(
    <div
      ref={panelRef}
      className={styles.imageEditPanel}
      style={{ left: 0, top: 0, width: `${panelW}px` }}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* 顶部标签行：参考 / 标记 / 风格 */}
      <div className={styles.imageEditPanelHead}>
        <div className={styles.imageEditBarTags}>
          <button className={styles.imageEditTag} title="上传参考图（通过卡片左下角图生图）">
            <ImagePlus size={11} />
            参考
            <RefreshCw size={10} className={styles.imageEditTagIcon} />
          </button>
          <button className={styles.imageEditTag}>
            <Tag size={11} />
            标记
          </button>
          <button className={styles.imageEditTag}>
            <Palette size={11} />
            风格
          </button>
        </div>
        <button className={styles.imageEditExpand} title="放大编辑（即将上线）" aria-label="放大编辑">
          <Maximize2 size={14} />
        </button>
      </div>

      {/* 中间输入框：编辑提示词 */}
      <input
        className={`${styles.imageEditInput} nodrag`}
        placeholder="描述想生成的图片，或对当前图片输入修改指令…"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") {
            e.preventDefault();
            onGenerate();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            edit.exitEdit();
          }
        }}
      />

      {/* 底部参数行：模型 / 比例画质张数 / 工具 / 发送 */}
      <div className={styles.imageEditParams}>
        <div className={styles.imageEditModelWrap}>
          <button
            className={styles.imageEditModel}
            onClick={() => {
              setShowModelMenu((v) => !v);
              setShowRatioMenu(false);
            }}
          >
            <Sparkles size={11} />
            {model}
            <ChevronDown size={10} />
          </button>
          {showModelMenu && (
            <div className={styles.imageEditRatioMenu}>
              <div className={styles.imageEditRatioMenuHead}>生图模型</div>
              {modelOptions.map((m) => (
                <button
                  key={m}
                  className={`${styles.imageEditRatioItem} ${m === model ? styles.imageEditRatioItemActive : ""}`}
                  onClick={() => {
                    setModel(m);
                    setShowModelMenu(false);
                  }}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
        </div>
        <span className={styles.imageEditParamSep} />
        <div className={styles.imageEditRatioWrap}>
          <button
            className={styles.imageEditParam}
            onClick={() => {
              setShowRatioMenu((v) => !v);
              setShowModelMenu(false);
            }}
          >
            <MonitorPlay size={11} />
            {ratio} · {quality}画质 · {count}张
            <ChevronDown size={9} />
          </button>
          {showRatioMenu && (
            <div className={styles.imageEditRatioMenu}>
              <div className={styles.imageEditRatioMenuHead}>画面比例</div>
              {ratioOptions.map((r) => (
                <button
                  key={r}
                  className={`${styles.imageEditRatioItem} ${r === ratio ? styles.imageEditRatioItemActive : ""}`}
                  onClick={() => {
                    setRatio(r);
                  }}
                >
                  {r}
                </button>
              ))}
              <div className={styles.imageEditRatioMenuHead}>画质</div>
              {["标准", "高清", "2K"].map((q) => (
                <button
                  key={q}
                  className={`${styles.imageEditRatioItem} ${q === quality ? styles.imageEditRatioItemActive : ""}`}
                  onClick={() => setQuality(q)}
                >
                  {q}
                </button>
              ))}
              <div className={styles.imageEditRatioMenuHead}>张数</div>
              {[1, 2, 4].map((c) => (
                <button
                  key={c}
                  className={`${styles.imageEditRatioItem} ${c === count ? styles.imageEditRatioItemActive : ""}`}
                  onClick={() => setCount(c)}
                >
                  {c} 张
                </button>
              ))}
            </div>
          )}
        </div>
        <span className={styles.imageEditParamSep} />
        <button className={styles.imageEditParamIcon} title="生成参数">
          <SlidersHorizontal size={11} />
        </button>
        <span className={styles.imageEditCost}>
          <Zap size={10} />
          {count * (quality === "2K" ? 24 : quality === "高清" ? 12 : 6)}
        </span>
        <button className={styles.imageEditSend} onClick={onGenerate} title="生成（Enter）">
          <Send size={12} />
        </button>
      </div>
    </div>,
    document.body,
  );
}

/* v34: 编辑栏外置到屏底居中（<ImageEditPanel/> via Portal），节点只渲染卡片 */
function ImageNodeEditor({ id, data }: { id: string; data: ImageNodeData }) {
  const edit = useContext(EnterEditContext);
  /* v34：编辑栏已外置，节点的 imageEditStateRef 由外层 ImageEditPanel 维护。
     这里只需要为节点"占位"留个空 ref（避免 commitEdit 走 image 分支时拿到 null） */
  useEffect(() => {
    if (edit.imageEditStateRef.current == null) {
      edit.imageEditStateRef.current = {
        prompt: data.prompt ?? "",
        ratio: data.ratio ?? "1:1",
        quality: data.quality ?? "标准",
        count: data.count ?? 1,
        model: data.model ?? "Weavl Image",
        url: data.url,
        title: edit.buffer.title,
      };
    }
  }, [edit, data]);

  return (
    <div className={styles.imageNodeEditWrap} onDoubleClick={(e) => e.stopPropagation()}>
      <div className={styles.imageNodeEditCardCol}>
        <ImageCardStatic id={id} d={data} editing />
      </div>
    </div>
  );
}

/* ---------------- TextNode：基础文本节点（v7：保持框形 + contentEditable） ---------------- */

function TextNode({ data, id }: NodeProps) {
  const edit = useContext(EnterEditContext);
  const d = data as unknown as TextNodeData;
  const editing = edit.editingId === id;

  if (editing) {
    return <TextNodeEditor data={d} />;
  }

  return (
    <div
      className={styles.textNode}
      style={
        d.width || d.height
          ? { width: d.width ? `${d.width}px` : undefined, height: d.height ? `${d.height}px` : undefined }
          : undefined
      }
      onDoubleClick={() => edit.enterEdit(id)}
    >
      <Handle type="target" position={Position.Left} className={styles.cardHandle} />
      <div className={styles.textNodeHead}>
        <TypeIcon size={12} />
        <span>{d.title || "文本"}</span>
      </div>
      <div
        className={styles.textNodeBody}
        style={
          d.height
            ? { maxHeight: "none", overflow: "hidden auto", WebkitLineClamp: "unset", display: "block" }
            : undefined
        }
      >
        {d.text || "输入文本内容…（双击编辑）"}
      </div>
      <Handle type="source" position={Position.Right} className={styles.cardHandle} />
    </div>
  );
}

/* v7 编辑态：复用 textNode 框形 + contentEditable
   - contentEditable **不做 React 受控**：挂载时把 buffer.text 写一次到 DOM 即可，
     DOM 自己维护文本，避免每次输入 setBuffer 触发 React 重渲染、把光标重置到末尾
   - IME composition 期间完全不动 buffer（避免中文输入被打断 / 重复触发）
   - commitEdit 时直接从 editorElRef 读最新 innerText，绕开 React state 异步
   - 节点头部不挂 nodrag → React Flow 拖拽节点生效；input/contentEditable 加 nodrag → 不被拖动接管 */
function TextNodeEditor({ data }: { data: TextNodeData }) {
  const edit = useContext(EnterEditContext);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const initialTextRef = useRef(edit.buffer.text);

  /* 挂载：buffer.text 写一次到 DOM，光标放到末尾 */
  useEffect(() => {
    if (!editorRef.current) return;
    if (editorRef.current.innerText !== initialTextRef.current) {
      editorRef.current.innerText = initialTextRef.current;
    }
    editorRef.current.focus();
    const range = document.createRange();
    range.selectNodeContents(editorRef.current);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }, []); // 仅挂载一次

  /* 把 DOM 当前文本同步进 buffer（仅在不在 IME composition 时调用） */
  const syncBufferFromDOM = useCallback(() => {
    if (!editorRef.current) return;
    if (edit.composingRef.current) return;
    const text = editorRef.current.innerText || "";
    edit.setBuffer({ title: edit.buffer.title, text });
  }, [edit]);

  /* 卸载：清理 ref */
  useEffect(() => {
    const editor = editorRef.current;
    edit.editorElRef.current = editor;
    return () => {
      if (edit.editorElRef.current === editor) {
        edit.editorElRef.current = null;
      }
    };
  }, [edit]);

  const styleSize =
    data.width || data.height
      ? { width: data.width ? `${data.width}px` : undefined, height: data.height ? `${data.height}px` : undefined }
      : undefined;

  return (
    <div
      ref={containerRef}
      className={`${styles.textNode} ${styles.textNodeEditing} nowheel`}
      style={styleSize}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <Handle type="target" position={Position.Left} className={styles.cardHandle} />
      <div className={styles.textNodeHead}>
        <TypeIcon size={12} />
        <input
          className={`${styles.textNodeTitleInput} nodrag`}
          value={edit.buffer.title}
          onChange={(e) => {
            edit.setBuffer({ title: e.target.value, text: edit.buffer.text });
          }}
          onKeyDown={(e) => e.stopPropagation()}
          placeholder="节点标题"
        />
      </div>
      <div
        ref={editorRef}
        className={`${styles.textNodeBodyEdit} nodrag`}
        contentEditable
        suppressContentEditableWarning
        spellCheck={false}
        /* 不在这里放 {text} children —— DOM 自己维护，避免 React 重置光标 */
        onCompositionStart={() => {
          edit.composingRef.current = true;
        }}
        onCompositionEnd={() => {
          edit.composingRef.current = false;
          syncBufferFromDOM();
        }}
        onInput={() => {
          /* 不在每次按键时 setBuffer，避免 React 重置光标；
          compositionEnd / blur / commit 时再统一同步。 */
        }}
        onBlur={() => {
          syncBufferFromDOM();
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            edit.exitEdit();
            return;
          }
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            syncBufferFromDOM();
            edit.commitEdit();
            return;
          }
          e.stopPropagation();
        }}
      />
      <Handle type="source" position={Position.Right} className={styles.cardHandle} />
    </div>
  );
}

/* ---------------- VideoNode：基础视频节点（v25：默认态 + 编辑态 = 原卡片不动 + 底部追加编辑栏） ---------------- */

/* v25：视频卡片静态结构 —— 默认态与编辑态共用同一组件 */
function VideoCardStatic({
  id,
  d,
  overrideUrl,
  onPickFile,
  onDoubleClick,
  editing = false,
}: {
  id: string;
  d: VideoNodeData;
  overrideUrl?: string;
  onPickFile?: (f: File | undefined) => void;
  onDoubleClick?: () => void;
  editing?: boolean;
}) {
  const edit = useContext(EnterEditContext);
  const tint = d.tint ?? "rgba(55, 138, 221, 0.20)";
  /* v35：视频节点默认尺寸与图片节点保持一致（300×200） */
  const w = d.size?.w ?? 300;
  const h = d.size?.h ?? 200;
  const displayTitle = d.title || "视频节点";
  const url = overrideUrl ?? d.url;
  const fileRef = useRef<HTMLInputElement | null>(null);

  /* 默认态上传视频：直接写回节点 url（不进编辑态） */
  const pickAndCommit = useCallback(
    (f: File | undefined) => {
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        edit.commitVideoEdit?.(id, { url: String(reader.result) });
      };
      reader.readAsDataURL(f);
    },
    [edit, id],
  );

  return (
    <>
      <div className={styles.imageNodeTitleAbove}>
        <VideoIcon size={12} />
        {editing ? (
          <input
            className={`${styles.imageNodeTitleInput} nodrag`}
            value={edit.buffer.title ?? ""}
            onChange={(e) => edit.setBuffer({ ...edit.buffer, title: e.target.value })}
            onKeyDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            placeholder="视频节点"
            spellCheck={false}
          />
        ) : (
          <span>{displayTitle}</span>
        )}
      </div>
      <div className={styles.imageNode} style={{ width: w, height: h }} onDoubleClick={onDoubleClick}>
        <Handle type="target" position={Position.Left} className={styles.cardHandle} />
        {/* 已有视频则显示视频预览，否则占位渐变 + 播放按钮 */}
        {url ? (
          <div className={styles.imagePreview}>
            <video src={url} className={styles.imageReal} muted preload="metadata" />
          </div>
        ) : (
          <div
            className={styles.imagePreview}
            style={{ background: `linear-gradient(135deg, ${tint} 0%, rgba(20, 20, 22, 0.6) 100%)` }}
          >
            <div className={styles.imagePlaceholder} style={{ color: "#b5d4f4" }}>
              <VideoIcon size={20} />
            </div>
            {/* 播放按钮 */}
            <div className={styles.videoPlay}>
              <svg width="18" height="18" viewBox="0 0 18 18">
                <circle cx="9" cy="9" r="8" fill="rgba(13, 13, 15, 0.6)" stroke="#b5d4f4" strokeWidth="1" />
                <path d="M7 5.5 L12 9 L7 12.5 Z" fill="#b5d4f4" />
              </svg>
            </div>
          </div>
        )}
        {/* v25：左下角 chip ——「尝试：↻」+ 三个常用能力 */}
        <div
          className={`${styles.imageTryChips} nodrag`}
          style={{ flexDirection: "column", alignItems: "flex-start", gap: 6 }}
        >
          <div style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <span className={styles.imageTryRefreshInline}>尝试：</span>
            <button className={styles.imageTryRefresh} title="换一换" onClick={() => fileRef.current?.click()}>
              <RefreshCw size={10} />
            </button>
          </div>
          <button className={styles.imageTryChip} title="即将上线：5 分钟超长视频">
            <span style={{ color: "#a8a8b2", fontSize: 11, display: "inline-flex", alignItems: "center" }}>∞</span>5
            分钟超长视频
          </button>
          <button className={styles.imageTryChip} title="即将上线：首尾帧生成视频">
            <Layers size={11} />
            首尾帧生成视频
          </button>
          <button className={styles.imageTryChip} title="即将上线：首帧生成视频">
            <Sparkles size={11} />
            首帧生成视频
          </button>
        </div>
        <Handle type="source" position={Position.Right} className={styles.cardHandle} />
        <input
          ref={fileRef}
          type="file"
          accept="video/*"
          hidden
          onChange={(e) => {
            (onPickFile ?? pickAndCommit)(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
    </>
  );
}

function VideoNode({ data, id }: NodeProps) {
  const edit = useContext(EnterEditContext);
  const d = data as unknown as VideoNodeData;

  if (edit.editingId === id) {
    return <VideoNodeEditor id={id} data={d} />;
  }

  return (
    <div className={styles.imageNodeWrap}>
      <VideoCardStatic id={id} d={d} onDoubleClick={() => edit.enterEdit(id)} />
    </div>
  );
}

/* v34.2：视频节点编辑栏外置到屏底居中（同图片节点方案） */
function VideoEditPanel() {
  const edit = useContext(EnterEditContext);
  const rf = useStore((s) => ({ tx: s.transform[0], ty: s.transform[1], zoom: s.transform[2] }), shallowEqual);
  const editingId = edit.editingId;
  const node = useStore((s) => (editingId ? (s.nodes.find((n) => n.id === editingId) ?? null) : null));
  const data = (node?.data as unknown as VideoNodeData | undefined) ?? null;
  const isVideo = (data as unknown as { nodeKind?: string } | undefined)?.nodeKind === "video";

  /* 所有 hooks 必须在 return 之前固定调用（Rules of Hooks） */
  const [prompt, setPrompt] = useState(data?.prompt ?? "");
  const [ratio, setRatio] = useState(data?.ratio ?? "16:9");
  const [quality, setQuality] = useState(data?.quality ?? "720P");
  const [duration, setDuration] = useState(data?.duration ?? 5);
  const [count, setCount] = useState(data?.count ?? 1);
  const [model, setModel] = useState(data?.model ?? "Weavl Video");
  const [refType, setRefType] = useState("全能参考");
  const [showRatioMenu, setShowRatioMenu] = useState(false);
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [showRefMenu, setShowRefMenu] = useState(false);
  useEffect(() => {
    if (!data) return;
    setPrompt(data.prompt ?? "");
    setRatio(data.ratio ?? "16:9");
    setQuality(data.quality ?? "720P");
    setDuration(data.duration ?? 5);
    setCount(data.count ?? 1);
    setModel(data.model ?? "Weavl Video");
  }, [edit.editingId, data]);
  useEffect(() => {
    edit.videoEditStateRef.current = { prompt, ratio, quality, duration, count, model, title: edit.buffer.title };
  }, [prompt, ratio, quality, duration, count, model, edit]);
  const onGenerate = useCallback(() => {
    if (!edit.editingId) return;
    edit.commitVideoEdit?.(edit.editingId, { prompt, ratio, quality, duration, count, model, title: undefined });
  }, [edit, prompt, ratio, quality, duration, count, model]);
  const ratioOptions = ["16:9", "9:16", "1:1", "4:3", "3:4"];
  const modelOptions = ["Weavl Video", "Lib Video", "Sora", "Veo"];
  const refOptions = ["全能参考", "人脸参考", "首尾帧", "角色一致性"];
  const cost = count * (quality === "2K" ? 60 : quality === "720P" ? 27 : 18);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const lastLeftRef = useRef(-1);
  const lastTopRef = useRef(-1);
  const lastWidthRef = useRef(-1);
  useEffect(() => {
    const compute = () => {
      if (!node || typeof window === "undefined") return;
      const panelEl = panelRef.current;
      if (!panelEl) return;
      const panelW = Math.max(320, Math.min(720, window.innerWidth * 0.4));
      const panelH = panelEl.offsetHeight || 80;
      const el = document.querySelector('.react-flow__node[data-id="' + node.id + '"]');
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const centerScreenX = rect.left + rect.width / 2;
      const rawLeft = centerScreenX - panelW / 2;
      const clampedLeft = Math.max(16, Math.min(window.innerWidth - panelW - 16, rawLeft));
      const rawTop = rect.bottom + 16;
      const maxTop = window.innerHeight - panelH - 16;
      const clampedTop = Math.min(rawTop, maxTop);
      if (clampedLeft !== lastLeftRef.current || clampedTop !== lastTopRef.current) {
        panelEl.style.transform = "translate3d(" + clampedLeft + "px, " + clampedTop + "px, 0)";
        lastLeftRef.current = clampedLeft;
        lastTopRef.current = clampedTop;
      }
      if (panelW !== lastWidthRef.current) {
        panelEl.style.width = panelW + "px";
        lastWidthRef.current = panelW;
      }
    };
    compute();
    const onResize = () => compute();
    window.addEventListener("resize", onResize);
    let raf = 0;
    const loop = () => {
      compute();
      raf = window.requestAnimationFrame(loop);
    };
    raf = window.requestAnimationFrame(loop);
    return () => {
      window.removeEventListener("resize", onResize);
      window.cancelAnimationFrame(raf);
    };
  }, [node, rf.tx, rf.ty, rf.zoom]);
  /* v36：移除飞入动画 —— 挂载时透明，首次定位后立即显示（无位移过渡） */
  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    el.style.opacity = "0";
    let raf = window.requestAnimationFrame(function show() {
      if (el.style.transform !== "") {
        el.style.opacity = "1";
      } else {
        raf = window.requestAnimationFrame(show);
      }
    });
    return () => window.cancelAnimationFrame(raf);
  }, [edit.editingId]);
  /* v34.2：只在编辑视频节点时渲染（early return 必须在所有 hooks 之后） */
  if (!edit.editingId || !isVideo) return null;
  const panelW = Math.max(320, Math.min(720, typeof window !== "undefined" ? window.innerWidth * 0.4 : 480));

  return createPortal(
    <div
      ref={panelRef}
      className={styles.imageEditPanel}
      style={{ left: 0, top: 0, width: `${panelW}px` }}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* 顶部标签行：参考 / 标记 / 特效 / 角色库 / 运镜 */}
      <div className={styles.imageEditPanelHead}>
        <div className={styles.imageEditBarTags}>
          <button className={styles.imageEditTag}>
            <ImagePlus size={11} />
            参考
            <RefreshCw size={10} className={styles.imageEditTagIcon} />
          </button>
          <button className={styles.imageEditTag}>
            <Tag size={11} />
            标记
          </button>
          <button className={styles.imageEditTag}>
            <Sparkles size={11} />
            特效
          </button>
          <button className={styles.imageEditTag}>
            <UserIcon size={11} />
            角色库
            <RefreshCw size={10} className={styles.imageEditTagIcon} />
          </button>
          <button className={styles.imageEditTag}>
            <Film size={11} />
            运镜
          </button>
        </div>
        <button className={styles.imageEditExpand} title="放大编辑（即将上线）" aria-label="放大编辑">
          <Maximize2 size={14} />
        </button>
      </div>

      {/* 中间输入行：左侧视频附件缩略 + 右侧输入框 */}
      <div className={styles.videoEditInputRow}>
        <button className={styles.videoEditAttatchment} title="上传视频素材">
          <VideoIcon size={11} />
          <span>1</span>
        </button>
        <input
          className={`${styles.imageEditInput} nodrag`}
          placeholder="描述你想要生成的画面内容，@引用素材"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") {
              e.preventDefault();
              onGenerate();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              edit.exitEdit();
            }
          }}
        />
      </div>

      {/* 底部参数行：模型 / 全能参考 / 比例·画质·时长·张数 / 工具按钮 / 发送 */}
      <div className={styles.imageEditParams}>
        <div className={styles.imageEditModelWrap}>
          <button
            className={styles.imageEditModel}
            onClick={() => {
              setShowModelMenu((v) => !v);
              setShowRatioMenu(false);
              setShowRefMenu(false);
            }}
          >
            <Sparkles size={11} />
            {model}
            <ChevronDown size={10} />
          </button>
          {showModelMenu && (
            <div className={styles.imageEditRatioMenu}>
              <div className={styles.imageEditRatioMenuHead}>生视频模型</div>
              {modelOptions.map((m) => (
                <button
                  key={m}
                  className={`${styles.imageEditRatioItem} ${m === model ? styles.imageEditRatioItemActive : ""}`}
                  onClick={() => {
                    setModel(m);
                    setShowModelMenu(false);
                  }}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
        </div>
        <span className={styles.imageEditParamSep} />
        <div className={styles.imageEditRatioWrap}>
          <button
            className={styles.imageEditParam}
            onClick={() => {
              setShowRefMenu((v) => !v);
              setShowModelMenu(false);
              setShowRatioMenu(false);
            }}
          >
            <Layers size={11} />
            {refType}
            <ChevronDown size={9} />
          </button>
          {showRefMenu && (
            <div className={styles.imageEditRatioMenu}>
              <div className={styles.imageEditRatioMenuHead}>参考类型</div>
              {refOptions.map((r) => (
                <button
                  key={r}
                  className={`${styles.imageEditRatioItem} ${r === refType ? styles.imageEditRatioItemActive : ""}`}
                  onClick={() => {
                    setRefType(r);
                    setShowRefMenu(false);
                  }}
                >
                  {r}
                </button>
              ))}
            </div>
          )}
        </div>
        <span className={styles.imageEditParamSep} />
        <div className={styles.imageEditRatioWrap}>
          <button
            className={styles.imageEditParam}
            onClick={() => {
              setShowRatioMenu((v) => !v);
              setShowModelMenu(false);
              setShowRefMenu(false);
            }}
          >
            <MonitorPlay size={11} />
            {ratio} · {quality} · {duration}s · {count}个
            <ChevronDown size={9} />
          </button>
          {showRatioMenu && (
            <div className={styles.imageEditRatioMenu}>
              <div className={styles.imageEditRatioMenuHead}>画面比例</div>
              {ratioOptions.map((r) => (
                <button
                  key={r}
                  className={`${styles.imageEditRatioItem} ${r === ratio ? styles.imageEditRatioItemActive : ""}`}
                  onClick={() => {
                    setRatio(r);
                  }}
                >
                  {r}
                </button>
              ))}
              <div className={styles.imageEditRatioMenuHead}>画质</div>
              {["480P", "720P", "2K"].map((q) => (
                <button
                  key={q}
                  className={`${styles.imageEditRatioItem} ${q === quality ? styles.imageEditRatioItemActive : ""}`}
                  onClick={() => setQuality(q)}
                >
                  {q}
                </button>
              ))}
              <div className={styles.imageEditRatioMenuHead}>时长（秒）</div>
              {[3, 5, 10].map((d) => (
                <button
                  key={d}
                  className={`${styles.imageEditRatioItem} ${d === duration ? styles.imageEditRatioItemActive : ""}`}
                  onClick={() => setDuration(d)}
                >
                  {d}s
                </button>
              ))}
              <div className={styles.imageEditRatioMenuHead}>张数</div>
              {[1, 2, 4].map((c) => (
                <button
                  key={c}
                  className={`${styles.imageEditRatioItem} ${c === count ? styles.imageEditRatioItemActive : ""}`}
                  onClick={() => setCount(c)}
                >
                  {c} 个
                </button>
              ))}
            </div>
          )}
        </div>
        <span className={styles.imageEditParamSep} />
        <button className={styles.imageEditParamIcon} title="语音输入">
          <Volume2 size={11} />
        </button>
        <button className={styles.imageEditParamIcon} title="脚本">
          <FileText size={11} />
        </button>
        <button className={styles.imageEditParamIcon} title="文字样式">
          <TypeGlyph size={11} />
        </button>
        <button className={styles.imageEditParamIcon} title="分享">
          <Share2 size={11} />
        </button>
        <span className={styles.imageEditCost}>
          <Zap size={10} />
          {cost}
        </span>
        <button className={styles.videoEditSend} onClick={onGenerate} title="生成（Enter）">
          <Send size={12} />
        </button>
      </div>
    </div>,
    document.body,
  );
}

function VideoNodeEditor({ id, data }: { id: string; data: VideoNodeData }) {
  const edit = useContext(EnterEditContext);
  useEffect(() => {
    if (edit.videoEditStateRef.current == null) {
      edit.videoEditStateRef.current = {
        prompt: data.prompt ?? "",
        ratio: data.ratio ?? "16:9",
        quality: data.quality ?? "720P",
        duration: data.duration ?? 5,
        count: data.count ?? 1,
        model: data.model ?? "Weavl Video",
        url: data.url,
        title: edit.buffer.title,
      };
    }
  }, [edit, data]);
  return React.createElement(
    "div",
    {
      className: styles.imageNodeEditWrap,
      onDoubleClick: (e) => e.stopPropagation(),
    },
    React.createElement(
      "div",
      { className: styles.imageNodeEditCardCol },
      React.createElement(VideoCardStatic, { id: id, d: data, editing: true }),
    ),
  );
}
const nodeTypes = { card: CardNode, image: ImageNode, text: TextNode, video: VideoNode };

/* 双击编辑：context 提供 editingId + save/exit + 共享 buffer + 格式化命令
   - editorElRef 让 commitEdit 能从 DOM 读到 contentEditable 最新文本（避免 React state 异步导致保存过时）
   - composingRef 跟踪 IME 输入态，composition 期间不动 buffer，避免打断中文输入 */
interface EditCtx {
  editingId: string | null;
  /* v35：当前编辑节点的 nodeKind（text/card/image/video），供工具栏按类型隐藏 */
  editingKind: string | null;
  buffer: { title: string; text: string };
  setBuffer: (b: { title: string; text: string }) => void;
  enterEdit: (id: string) => void;
  saveEdit: (id: string, title: string, text: string) => void;
  commitEdit: () => void;
  /* v15：图片节点编辑态提交（prompt/参数/模型/图片写回节点 data） */
  commitImageEdit:
    | ((
        id: string,
        payload: {
          prompt?: string;
          ratio?: string;
          quality?: string;
          count?: number;
          model?: string;
          url?: string;
          title?: string;
        },
      ) => void)
    | null;
  /* v25：视频节点编辑态提交 */
  commitVideoEdit:
    | ((
        id: string,
        payload: {
          prompt?: string;
          ratio?: string;
          quality?: string;
          duration?: number;
          count?: number;
          model?: string;
          url?: string;
          title?: string;
        },
      ) => void)
    | null;
  exitEdit: () => void;
  focusMode: { nodeId: string | null };
  onApplyFormat: (cmd: string, value?: string) => void;
  editorElRef: React.MutableRefObject<HTMLDivElement | null>;
  composingRef: React.MutableRefObject<boolean>;
  /* v15：图片编辑器实时状态（点外部保存时从这里取最新值） */
  imageEditStateRef: React.MutableRefObject<{
    prompt?: string;
    ratio?: string;
    quality?: string;
    count?: number;
    model?: string;
    url?: string;
    title?: string;
  } | null>;
  /* v25：视频编辑器实时状态 */
  videoEditStateRef: React.MutableRefObject<{
    prompt?: string;
    ratio?: string;
    quality?: string;
    duration?: number;
    count?: number;
    model?: string;
    url?: string;
    title?: string;
  } | null>;
}

/* 富文本工具栏按钮（v7：顶部浮动，节点聚焦时才显示） */
function FloatingToolbar() {
  const edit = useContext(EnterEditContext);
  if (!edit.focusMode.nodeId) return null;
  /* v35：图片/视频节点编辑态不显示富文本工具栏（改名走节点上方标题输入框） */
  if (edit.editingKind === "image" || edit.editingKind === "video") return null;
  const apply = (cmd: string, value?: string) => edit.onApplyFormat(cmd, value);

  return (
    <div className={styles.floatingToolbar}>
      <select
        className={styles.tbSelect}
        onChange={(e) => {
          apply("fontName", e.target.value);
          e.currentTarget.selectedIndex = 0;
        }}
        defaultValue=""
      >
        <option value="" disabled>
          字体
        </option>
        <option value="PingFang SC">PingFang</option>
        <option value="system-ui">系统</option>
        <option value="serif">衬线</option>
        <option value="monospace">等宽</option>
      </select>
      <select
        className={styles.tbSelectNarrow}
        onChange={(e) => {
          apply("fontSize", e.target.value);
          e.currentTarget.selectedIndex = 0;
        }}
        defaultValue=""
      >
        <option value="" disabled>
          14
        </option>
        <option value="3">12</option>
        <option value="4">14</option>
        <option value="5">18</option>
        <option value="6">24</option>
        <option value="7">32</option>
      </select>
      <span className={styles.tbSep} />
      <button className={styles.tbBtn} title="加粗" onClick={() => apply("bold")}>
        <b>B</b>
      </button>
      <button className={styles.tbBtn} title="斜体" onClick={() => apply("italic")}>
        <i>I</i>
      </button>
      <button className={styles.tbBtn} title="下划线" onClick={() => apply("underline")}>
        <u>U</u>
      </button>
      <button className={styles.tbBtn} title="删除线" onClick={() => apply("strikeThrough")}>
        <s>S</s>
      </button>
      <span className={styles.tbBtn} title="字体颜色">
        <input
          type="color"
          defaultValue="#e6e8ec"
          className={styles.tbColor}
          onChange={(e) => apply("foreColor", e.target.value)}
        />
      </span>
      <span className={styles.tbBtn} title="背景高亮">
        <input
          type="color"
          defaultValue="#f59e0b"
          className={styles.tbColor}
          onChange={(e) => apply("hiliteColor", e.target.value)}
        />
      </span>
      <span className={styles.tbSep} />
      <button className={styles.tbBtn} title="居左" onClick={() => apply("justifyLeft")}>
        ≡
      </button>
      <button className={styles.tbBtn} title="居中" onClick={() => apply("justifyCenter")}>
        ≣
      </button>
      <button className={styles.tbBtn} title="居右" onClick={() => apply("justifyRight")}>
        ≡
      </button>
      <span className={styles.tbSep} />
      <button className={styles.tbBtn} title="无序列表" onClick={() => apply("insertUnorderedList")}>
        •
      </button>
      <button className={styles.tbBtn} title="有序列表" onClick={() => apply("insertOrderedList")}>
        1.
      </button>
      <span className={styles.tbBtn} title="减少缩进" onClick={() => apply("outdent")}>
        <Minus size={12} />
      </span>
      <span className={styles.tbBtn} title="增加缩进" onClick={() => apply("indent")}>
        <Pilcrow size={12} />
      </span>
      <span className={styles.tbSep} />
      <button
        className={styles.tbBtn}
        title="链接"
        onClick={() => {
          const url = window.prompt("输入链接 URL");
          if (url) apply("createLink", url);
        }}
      >
        ⌘
      </button>
      <button className={styles.tbBtn} title="清除格式" onClick={() => apply("removeFormat")}>
        <RemoveFormatting size={12} />
      </button>
    </div>
  );
}

/* 左侧悬浮操作面板：完成 / 取消（v7：节点外浮层，不嵌在节点里） */
/* v10：EditActionPanel 已移除 —— 编辑态点击外部自动保存（commitEdit），
   ESC 取消。原左侧完成/取消悬浮面板不再需要。 */

/* 节点内编辑器：放大后的节点本体（带格式化工具条 + textarea） */
function NodeEditor({
  categoryLabel,
  initialTitle,
  initialText,
  onSave,
  onCancel,
  accentColor,
}: {
  categoryLabel: string;
  initialTitle: string;
  initialText: string;
  onSave: (title: string, text: string) => void;
  onCancel: () => void;
  accentColor: string;
}) {
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const [title, setTitle] = useState(initialTitle);
  const [text, setText] = useState(initialText);

  useEffect(() => {
    requestAnimationFrame(() => taRef.current?.focus());
  }, []);

  const wrapLine = (prefix: string) => {
    const ta = taRef.current;
    if (!ta) return;
    const { selectionStart, selectionEnd, value } = ta;
    const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
    const nv = value.slice(0, lineStart) + prefix + value.slice(lineStart);
    setText(nv);
    requestAnimationFrame(() => {
      ta.selectionStart = selectionStart + prefix.length;
      ta.selectionEnd = selectionEnd + prefix.length;
      ta.focus();
    });
  };
  const wrapSel = (before: string, after?: string) => {
    const ta = taRef.current;
    if (!ta) return;
    const { selectionStart, selectionEnd, value } = ta;
    const sel = value.slice(selectionStart, selectionEnd);
    const nv = value.slice(0, selectionStart) + before + sel + (after ?? "") + value.slice(selectionEnd);
    setText(nv);
    requestAnimationFrame(() => {
      ta.selectionStart = selectionStart + before.length;
      ta.selectionEnd = selectionEnd + before.length;
      ta.focus();
    });
  };
  const copyAll = () => {
    void navigator.clipboard?.writeText(text);
    toast("已复制到剪贴板", "success");
  };

  const FB = ({
    label,
    title: t,
    onClick,
    bold,
    italic,
    strike,
  }: {
    label: string;
    title?: string;
    onClick: () => void;
    bold?: boolean;
    italic?: boolean;
    strike?: boolean;
  }) => (
    <button
      className={styles.formatBtn}
      title={t ?? label}
      onClick={onClick}
      style={{
        fontWeight: bold ? 700 : 500,
        fontStyle: italic ? "italic" : "normal",
        textDecoration: strike ? "line-through" : "none",
      }}
    >
      {label}
    </button>
  );

  return (
    <div className={styles.nodeEditor} style={{ borderColor: accentColor }} onDoubleClick={(e) => e.stopPropagation()}>
      {/* 头部 */}
      <div className={styles.nodeEditorHead}>
        <span className={styles.nodeEditorCategory} style={{ color: accentColor }}>
          {categoryLabel}
        </span>
        <input
          className={styles.nodeEditorTitleInput}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") taRef.current?.focus();
            e.stopPropagation();
          }}
          placeholder="标题"
          aria-label="节点标题"
        />
        <button className={styles.nodeEditorBtn} title="AI 重写（即将上线）" disabled>
          <Sparkles size={12} />
        </button>
        <button className={styles.nodeEditorBtn} title="保存（⌘+Enter）" onClick={() => onSave(title, text)}>
          <CheckCircle2 size={12} />
        </button>
        <button className={styles.nodeEditorBtn} title="取消（ESC）" onClick={onCancel}>
          <X size={12} />
        </button>
      </div>

      {/* 格式化工具条 */}
      <div className={styles.formatBar}>
        <FB label="H1" onClick={() => wrapLine("# ")} />
        <FB label="H2" onClick={() => wrapLine("## ")} />
        <FB label="H3" onClick={() => wrapLine("### ")} />
        <span className={styles.formatSep} />
        <FB label="❝" title="引用" onClick={() => wrapLine("> ")} />
        <FB label="B" title="加粗" bold onClick={() => wrapSel("**", "**")} />
        <FB label="I" title="斜体" italic onClick={() => wrapSel("*", "*")} />
        <span className={styles.formatSep} />
        <FB label="1." title="有序列表" onClick={() => wrapLine("1. ")} />
        <FB label="•" title="无序列表" onClick={() => wrapLine("- ")} />
        <FB label="S" title="删除线" strike onClick={() => wrapSel("~~", "~~")} />
        <span className={styles.formatSep} />
        <FB label="⧉" title="复制全文" onClick={copyAll} />
      </div>

      {/* 编辑区 */}
      <textarea
        ref={taRef}
        className={styles.nodeEditorArea}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onCancel();
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onSave(title, text);
          e.stopPropagation();
        }}
        placeholder="输入内容…（Markdown 语法，⌘+Enter 保存，ESC 取消）"
      />

      <div className={styles.nodeEditorFoot}>
        <span>{text.length} 字 · 双击节点进入编辑</span>
      </div>
    </div>
  );
}

/* ---------------- 画布主体 ---------------- */

function CanvasInner() {
  const { screenToFlowPosition, setCenter } = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  /* v32.5：挂载时清洗 v27 时代 type:"bezier" 隐形边 → "default"（React Flow 无此内置类型不渲染） */
  useEffect(() => {
    setEdges((es) =>
      es.some((e) => e.type === "bezier")
        ? es.map((e) => (e.type === "bezier" ? ({ ...e, type: "default" } as Edge) : e))
        : es,
    );
  }, [setEdges]);
  const [showLibrary, setShowLibrary] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  /* v39：积分悬停弹窗（hover 200ms 开、离开 150ms 缓冲关） */
  const [creditHover, setCreditHover] = useState(false);
  const creditOpenTimer = useRef<number | null>(null);
  const creditCloseTimer = useRef<number | null>(null);
  const openCredit = useCallback(() => {
    if (creditCloseTimer.current) {
      window.clearTimeout(creditCloseTimer.current);
      creditCloseTimer.current = null;
    }
    if (creditHover) return;
    creditOpenTimer.current = window.setTimeout(() => setCreditHover(true), 200);
  }, [creditHover]);
  const closeCredit = useCallback(() => {
    if (creditOpenTimer.current) {
      window.clearTimeout(creditOpenTimer.current);
      creditOpenTimer.current = null;
    }
    if (!creditHover) return;
    creditCloseTimer.current = window.setTimeout(() => setCreditHover(false), 150);
  }, [creditHover]);
  useEffect(
    () => () => {
      if (creditOpenTimer.current) window.clearTimeout(creditOpenTimer.current);
      if (creditCloseTimer.current) window.clearTimeout(creditCloseTimer.current);
    },
    [],
  );
  /* v38：Agent 抽屉（右上角头像展开）+ 气泡消息流 */
  const [agentOpen, setAgentOpen] = useState(false);
  const [agentMessages, setAgentMessages] = useState<{ role: "user" | "agent"; text: string; thumb?: string | null }[]>(
    [{ role: "agent", text: "你好，我是织光 Agent。告诉我想要的内容，我来帮你编排画布。" }],
  );
  const [chatInput, setChatInput] = useState("");
  const [chatThumb, setChatThumb] = useState<string | null>(null);
  const [chatModel] = useState("Weavl LLM");
  const [hasRun, setHasRun] = useState(false);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBuffer, setEditBuffer] = useState<{ title: string; text: string }>({ title: "", text: "" });
  /* v7：contentEditable DOM 引用（让 commitEdit 能读到最新 innerText）+ IME composition 标志 */
  const editorElRef = useRef<HTMLDivElement | null>(null);
  const composingRef = useRef(false);
  /* v13：从 source handle 拖出连线时记录起始节点，松手时若在空白处 → 创建新节点 + 连线 */
  const connectStartRef = useRef<{ nodeId: string | null; clientX: number; clientY: number }>({
    nodeId: null,
    clientX: 0,
    clientY: 0,
  });
  /* v40：click-outside-to-close —— 给 + 添加菜单 / Agent 抽屉 / 节点库提供 ref，
     在 useClickOutside 里统一判断「pointerdown 在白名单外则关闭」。 */
  const addMenuRef = useRef<HTMLDivElement | null>(null);
  const addFabBtnRef = useRef<HTMLButtonElement | null>(null);
  const agentDrawerRef = useRef<HTMLDivElement | null>(null);
  const agentBtnRef = useRef<HTMLButtonElement | null>(null);
  const libraryRef = useRef<HTMLDivElement | null>(null);

  /* 进入编辑：初始化 buffer + 平移居中 + 稍微放大（v11：退出时不再复位视口，所以无需保存） */
  const enterEdit = useCallback(
    (id: string) => {
      const n = nodes.find((x) => x.id === id);
      if (!n) return;
      const d = n.data as Record<string, unknown>;
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
      // 节点居中 + 放大到 2.0（进入编辑时，参考 LibTV 200%）
      // 用节点实际渲染尺寸计算中心，避免视觉偏移
      const w = n.measured?.width ?? (typeof d.width === "number" ? d.width : 440);
      const h = n.measured?.height ?? (typeof d.height === "number" ? d.height : 120);
      void setCenter(n.position.x + w / 2, n.position.y + h / 2, { zoom: 2, duration: 320 });
      setEditingId(id);
    },
    [nodes, setCenter],
  );

  /* 退出编辑：v11 视口保持不动（位置和缩放都不变），只关编辑态 */
  const exitEdit = useCallback(() => {
    setEditingId(null);
  }, []);

  /* 写回节点 data（v6 节点内编辑器走这条） */
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

  /* v6 入口：传入 id/title/text 直接写回 */
  const saveEdit = useCallback(
    (id: string, title: string, text: string) => {
      writeNodeData(id, title, text);
      exitEdit();
    },
    [writeNodeData, exitEdit],
  );

  /* v14：图片编辑器实时状态 ref（编辑器组件每次状态变化时写入） */
  const imageEditStateRef = useRef<EditCtx["imageEditStateRef"]["current"]>(null);

  /* v15：图片节点编辑提交 —— prompt/参数/模型/图片写回节点 data */
  const commitImageEdit = useCallback(
    (
      id: string,
      payload: {
        prompt?: string;
        ratio?: string;
        quality?: string;
        count?: number;
        model?: string;
        url?: string;
        title?: string;
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
          if (typeof payload.count === "number") d.count = payload.count;
          if (payload.model) d.model = payload.model;
          if (payload.url !== undefined) d.url = payload.url;
          /* 有 prompt 没有图 → 占位色改成生成中样式（后续接真生图 API 时替换） */
          return { ...n, data: d as unknown as AnyNodeData } as unknown as Node;
        }),
      );
      exitEdit();
    },
    [setNodes, exitEdit],
  );

  /* v25：视频编辑器实时状态 ref（编辑器组件每次状态变化时写入） */
  const videoEditStateRef = useRef<EditCtx["videoEditStateRef"]["current"]>(null);

  /* v25：视频节点编辑提交 —— prompt/参数/视频写回节点 data */
  const commitVideoEdit = useCallback(
    (
      id: string,
      payload: {
        prompt?: string;
        ratio?: string;
        quality?: string;
        duration?: number;
        count?: number;
        model?: string;
        url?: string;
        title?: string;
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
          if (typeof payload.duration === "number") d.duration = payload.duration;
          if (typeof payload.count === "number") d.count = payload.count;
          if (payload.model) d.model = payload.model;
          if (payload.url !== undefined) d.url = payload.url;
          return { ...n, data: d as unknown as AnyNodeData } as unknown as Node;
        }),
      );
      exitEdit();
    },
    [setNodes, exitEdit],
  );

  /* v7 入口：commitEdit 直接从 contentEditable DOM 读最新 innerText（避免 React state 异步导致保存过时）
     v14：图片节点编辑态时改走 commitImageEdit（用 imageEditStateRef 里的实时状态）
     v25：视频节点编辑态时改走 commitVideoEdit */
  const commitEdit = useCallback(() => {
    if (!editingId) return;
    const editingNode = nodes.find((n) => n.id === editingId);
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
    /* 节点容器尺寸（用户在编辑态拖出来的宽/高）一并保存 */
    const container = editor?.parentElement;
    const size =
      container && container.offsetWidth > 0 && container.offsetHeight > 0
        ? { w: container.offsetWidth, h: container.offsetHeight }
        : undefined;
    writeNodeData(editingId, editBuffer.title, finalText, size);
    exitEdit();
  }, [editingId, editBuffer, writeNodeData, exitEdit, nodes, commitImageEdit, commitVideoEdit]);

  /* 工具栏格式化命令：作用于当前 contentEditable 焦点 */
  const onApplyFormat = useCallback((cmd: string, value?: string) => {
    try {
      document.execCommand(cmd, false, value);
    } catch {
      /* 浏览器不支持时静默失败 */
    }
  }, []);

  /* 选中节点时同步 selectedNode（用于顶部 NodeToolbar 浮出） */
  const onSelectionChange = useCallback(({ nodes: sel }: { nodes: Node[] }) => {
    setSelectedNode(sel[0] ?? null);
  }, []);

  /* 从最近任务自动铺：图像步骤用 image 节点，文字步骤用 card 节点 */
  const loadFromLatest = useCallback(async () => {
    try {
      const res = await fetch(`${API}/runs/latest/_pick`);
      if (!res.ok) return;
      const data: RunView = await res.json();
      const gateSteps = new Set((data.decisions ?? []).map((d) => d.gate));
      const stepIds = ["topics", "copywriting", "cover-concept", "cover", "check", "package"];
      const layout: Node[] = stepIds.map((sid, i) => {
        const isGate = gateSteps.has(sid);
        const isCover = sid === "cover" || sid === "cover-concept";
        const isPackage = sid === "package";
        if (isCover) {
          return {
            id: `s_${sid}`,
            type: "image",
            position: { x: 80, y: 80 + i * 200 },
            data: {
              nodeKind: "image",
              kind: "image",
              title: STAGE_TITLES[sid],
              category: isGate ? "确认门 · 封面" : "封面",
              tint: "rgba(212, 83, 126, 0.18)",
              size: { w: 200, h: 260 },
            },
          };
        }
        if (isPackage && data.contentPackage) {
          return {
            id: `s_${sid}`,
            type: "card",
            position: { x: 80, y: 80 + i * 200 },
            data: {
              nodeKind: "card",
              kind: "output",
              title: "内容包",
              category: "产物",
              fields: [
                { label: "标题", value: data.contentPackage.fields[0]?.value?.slice(0, 28) ?? "—" },
                { label: "正文", value: data.contentPackage.fields[1]?.value?.slice(0, 28) ?? "—" },
                { label: "封面", value: data.contentPackage.fields[2]?.value?.slice(0, 28) ?? "—" },
                { label: "话题", value: data.contentPackage.fields[3]?.value?.slice(0, 28) ?? "—" },
              ],
            },
          };
        }
        // 文字节点
        return {
          id: `s_${sid}`,
          type: "card",
          position: { x: 80, y: 80 + i * 200 },
          data: {
            nodeKind: "card",
            kind: "llm",
            title: STAGE_TITLES[sid],
            category: isGate ? `确认门 · ${STAGE_TITLES[sid]}` : STAGE_TITLES[sid],
            isGate,
            fields: [
              { label: "类型", value: "测评/故事/清单" },
              { label: "候选", value: "3 个" },
              ...(isGate ? [{ label: "状态", value: "等待确认" }] : [{ label: "状态", value: "已确认" }]),
            ],
          },
        };
      });
      const layoutEdges: Edge[] = stepIds.slice(0, -1).map((sid, i) => ({
        id: `e_${sid}`,
        source: `s_${sid}`,
        target: `s_${stepIds[i + 1]}`,
        type: "smoothstep",
        style: { stroke: "#5e5e66", strokeWidth: 1.2 },
        label: i % 2 === 0 ? "点击按钮，可替换上传" : undefined,
        labelStyle: { fill: "#a8a8b2", fontSize: 10 },
        labelBgStyle: { fill: "rgba(20, 20, 22, 0.92)", stroke: "#232326" },
        labelBgPadding: [6, 4] as [number, number],
        labelBgBorderRadius: 8,
      }));
      setNodes(layout);
      setEdges(layoutEdges);
      setHasRun(true);
    } catch {
      /* API 未启时保持空态 */
    }
  }, [setNodes, setEdges]);

  useEffect(() => {
    fetch(`${API}/runs/latest/_pick`)
      .then((r) => setHasRun(r.ok))
      .catch(() => {});
  }, []);

  /* v7：编辑模式下，全局 ESC 退出（即使焦点不在节点内） */
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

  /* v10：编辑模式下，点击编辑节点外部（画布空白处 / 页面其它区域）自动保存退出 */
  useEffect(() => {
    if (!editingId) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      /* 点在文本编辑节点内部（含标题输入框、正文、resize 句柄）→ 不处理 */
      if (target.closest(`.${styles.textNodeEditing}`)) return;
      /* 点在图片编辑节点内部（卡片 + 底部编辑栏）→ 不处理 */
      if (target.closest(`.${styles.imageNodeEditWrap}`)) return;
      /* v36：图片/视频编辑栏（Portal 到 body 的 panel）→ 不处理 —— 这里有 prompt 输入框 */
      if (target.closest(`.${styles.imageEditPanel}`)) return;
      /* 点在顶部格式化工具栏上 → 不处理（工具栏按钮要保持焦点操作正文） */
      if (target.closest(`.${styles.floatingToolbar}`)) return;
      e.preventDefault();
      e.stopPropagation();
      commitEdit();
    };
    /* 用 pointerdown 捕获阶段，抢在画布平移/节点选择之前 */
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => window.removeEventListener("pointerdown", onPointerDown, true);
  }, [editingId, commitEdit]);

  /* v40.1：click-outside-to-close — 抽到 useClickOutside，三个弹窗独立监听 */
  useClickOutside(showAddMenu, [addMenuRef, addFabBtnRef], () => setShowAddMenu(false));
  useClickOutside(agentOpen, [agentDrawerRef, agentBtnRef], () => setAgentOpen(false));
  useClickOutside(showLibrary, [libraryRef], () => setShowLibrary(false));

  /* 添加基础节点（文本/图片/视频）—— 右键菜单 & 工具栏 & 节点库基础区共用 */
  const addBasicNode = useCallback(
    (kind: "text" | "image" | "video", position?: { x: number; y: number }) => {
      const pos = position ?? { x: 400 + Math.random() * 80, y: 320 + Math.random() * 80 };
      setNodes((ns) => {
        if (kind === "text") {
          return [
            ...ns,
            {
              id: nextNodeId(),
              type: "text",
              position: pos,
              data: { nodeKind: "text", title: "文本", text: "" } satisfies TextNodeData,
            },
          ];
        }
        if (kind === "image") {
          return [
            ...ns,
            {
              id: nextNodeId(),
              type: "image",
              position: pos,
              data: {
                nodeKind: "image",
                kind: "image",
                title: "图片",
                category: "图片",
                tint: "rgba(212, 83, 126, 0.18)",
                size: { w: 300, h: 200 },
              } satisfies ImageNodeData,
            },
          ];
        }
        return [
          ...ns,
          {
            id: nextNodeId(),
            type: "video",
            position: pos,
            data: {
              nodeKind: "video",
              title: "视频",
              category: "视频",
              tint: "rgba(55, 138, 221, 0.20)",
              size: { w: 300, h: 200 },
            } satisfies VideoNodeData,
          },
        ];
      });
      setContextMenu(null);
    },
    [setNodes],
  );

  /* 右键菜单状态 */
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; flowPos: { x: number; y: number } } | null>(
    null,
  );
  const onPaneContextMenu = useCallback(
    (e: React.MouseEvent | MouseEvent) => {
      e.preventDefault();
      const rect = (e.target as HTMLElement).closest(`.${styles.board}`)?.getBoundingClientRect();
      if (!rect) return;
      setContextMenu({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        flowPos: screenToFlowPosition({ x: e.clientX, y: e.clientY }),
      });
    },
    [screenToFlowPosition],
  );

  /* 节点库添加（业务能力） */
  const addFromLibrary = useCallback(
    (idx: number) => {
      const lib = NODE_LIBRARY[idx];
      if (!lib) return;
      const baseX = 400 + Math.random() * 80;
      const baseY = 320 + Math.random() * 80;
      if (lib.nodeKind === "image") {
        setNodes((ns) => [
          ...ns,
          {
            id: nextNodeId(),
            type: "image",
            position: { x: baseX, y: baseY },
            data: {
              nodeKind: "image",
              kind: lib.kind,
              title: lib.title,
              category: lib.category,
              tint: lib.tint,
              size: lib.size ?? { w: 240, h: 180 },
            },
          },
        ]);
      } else {
        setNodes((ns) => [
          ...ns,
          {
            id: nextNodeId(),
            type: "card",
            position: { x: baseX, y: baseY },
            data: {
              nodeKind: "card",
              kind: lib.kind,
              title: lib.title,
              category: lib.category,
              fields: lib.fields,
            },
          },
        ]);
      }
      setShowLibrary(false);
    },
    [setNodes],
  );

  /* v13：连接已存在节点 —— source handle 拖到 target handle 直接建边
     v28：校验必须落在 target handle 上才建边（避免松手在任意节点上误连） */
  const isValidConnection = useCallback(
    (connection: {
      source?: string | null;
      target?: string | null;
      sourceHandle?: string | null;
      targetHandle?: string | null;
    }) => Boolean(connection.target && connection.source && connection.target !== connection.source),
    [],
  );
  /* v32.5：连接 helper —— 先移除同节点对的旧边（含隐形残留），再添加带 success 动画的新边 */
  const addEdgeDedup = useCallback(
    (source: string, target: string) => {
      const newEdgeId = `e_${Date.now()}`;
      setEdges((es) => [
        /* 去掉同节点对（含反向）旧边 —— 修复 v27 时代 type:"bezier" 隐形边残留 */
        ...es.filter(
          (e) => !((e.source === source && e.target === target) || (e.source === target && e.target === source)),
        ),
        {
          id: newEdgeId,
          source,
          target,
          type: "default",
          className: "success-draw",
          style: { stroke: "#b5d4f4", strokeWidth: 1.8 },
        } as Edge,
      ]);
      /* 动画 320ms 结束后移除 success-draw className，避免 dasharray 残留 */
      window.setTimeout(() => {
        setEdges((es) =>
          es.map((e) =>
            e.id === newEdgeId ? { ...e, className: "", style: { stroke: "#9a9aa3", strokeWidth: 1.8 } } : e,
          ),
        );
      }, 360);
      /* 目标节点闪光 400ms */
      const targetEl = document.querySelector(`.react-flow__node[data-id="${target}"]`) as HTMLElement | null;
      if (targetEl) {
        targetEl.classList.add("node-flash");
        window.setTimeout(() => targetEl.classList.remove("node-flash"), 420);
      }
      return newEdgeId;
    },
    [setEdges],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target || connection.source === connection.target) return;
      addEdgeDedup(connection.source, connection.target);
    },
    [addEdgeDedup],
  );

  /* v13：从 source handle 开始拖线 —— 记录起始节点 + 起始坐标 */
  const onConnectStart = useCallback(
    (_: unknown, params: { nodeId: string | null; handleId: string | null; handleType: string | null }) => {
      if (params.handleType !== "source") return;
      connectStartRef.current = { nodeId: params.nodeId, clientX: 0, clientY: 0 };
      /* v32：开始拖线，重置 hover/preview/error 状态 */
      setHoverTargetId(null);
      setPreviewState(null);
      setConnectError(null);
    },
    [],
  );

  /* v32：拖线连接状态 —— 三态预览 + 成功动效 + 失败 toast */
  const [connectMenu, setConnectMenu] = useState<{
    sourceNodeId: string;
    flowPos: { x: number; y: number };
    clientPos: { x: number; y: number };
  } | null>(null);
  /* v32：拖线中悬停的目标节点（用来高亮） */
  const [hoverTargetId, setHoverTargetId] = useState<string | null>(null);
  /* v32：拖线中是否在合法位置上 —— true: 可连 / false: 不可连 / null: 拖到 pane */
  const [previewState, setPreviewState] = useState<"connectable" | "blocked" | null>(null);
  /* v32：连接失败 toast */
  const [connectError, setConnectError] = useState<string | null>(null);
  const connectErrorTimerRef = useRef<number | null>(null);

  /* v32：判断某节点是否可作为连线目标（用于 hover 状态判定） */
  const isValidTarget = useCallback(
    (targetId: string): { ok: boolean; reason?: string } => {
      const sourceId = connectStartRef.current.nodeId;
      if (!sourceId) return { ok: false, reason: "未在拖线状态" };
      if (targetId === sourceId) return { ok: false, reason: "不能连到自身" };
      /* 重复边校验 */
      const dup = edges.some(
        (e) => (e.source === sourceId && e.target === targetId) || (e.source === targetId && e.target === sourceId),
      );
      if (dup) return { ok: false, reason: "已存在连线" };
      return { ok: true };
    },
    [edges],
  );

  /* v32：节点 hover 同步 + pane 兜底：通过 mouseover/mouseout 监听 board */
  useEffect(() => {
    const board = document.querySelector(`.${styles.board}`);
    if (!board) return;
    const onMouseOver: EventListener = (e) => {
      if (!connectStartRef.current.nodeId) return;
      const t = e.target as HTMLElement | null;
      if (!t) return;
      const nodeEl = t.closest(".react-flow__node") as HTMLElement | null;
      if (nodeEl?.dataset?.id) {
        const targetId = nodeEl.dataset.id;
        setHoverTargetId(targetId);
        const v = isValidTarget(targetId);
        setPreviewState(v.ok ? "connectable" : "blocked");
        if (!v.ok) {
          setConnectError(v.reason ?? null);
        } else {
          setConnectError(null);
        }
      } else {
        setHoverTargetId(null);
        setPreviewState(null);
        setConnectError(null);
      }
    };
    const onMouseOut: EventListener = (e) => {
      if (!connectStartRef.current.nodeId) return;
      const me = e as MouseEvent;
      const related = me.relatedTarget as HTMLElement | null;
      const stillInNode = related?.closest(".react-flow__node");
      if (!stillInNode) {
        setHoverTargetId(null);
        setPreviewState(null);
        setConnectError(null);
      }
    };
    board.addEventListener("mouseover", onMouseOver);
    board.addEventListener("mouseout", onMouseOut);
    return () => {
      board.removeEventListener("mouseover", onMouseOver);
      board.removeEventListener("mouseout", onMouseOut);
    };
  }, [isValidTarget]);

  /* v32：连接失败时短暂显示 toast */
  const showConnectError = useCallback((msg: string) => {
    setConnectError(msg);
    if (connectErrorTimerRef.current) window.clearTimeout(connectErrorTimerRef.current);
    connectErrorTimerRef.current = window.setTimeout(() => setConnectError(null), 1800);
  }, []);

  /* v32：根据 previewState 给目标节点加 .connectable-target / .blocked-target class */
  useEffect(() => {
    if (hoverTargetId) {
      const el = document.querySelector(`.react-flow__node[data-id="${hoverTargetId}"]`) as HTMLElement | null;
      if (!el) return;
      const cls = previewState === "blocked" ? "blocked-target" : "connectable-target";
      el.classList.add(cls);
      return () => el.classList.remove(cls);
    }
  }, [hoverTargetId, previewState]);

  const onConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent) => {
      const start = connectStartRef.current;
      connectStartRef.current = { nodeId: null, clientX: 0, clientY: 0 };
      const wasHoverId = hoverTargetId;
      const wasPreview = previewState;
      const wasError = connectError;
      /* 拖线结束，重置 hover/preview/error 状态 */
      setHoverTargetId(null);
      setPreviewState(null);
      setConnectError(null);
      if (!start.nodeId) return;
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const isTouch = "touches" in event;
      const clientX = isTouch ? (event.changedTouches?.[0]?.clientX ?? 0) : (event as MouseEvent).clientX;
      const clientY = isTouch ? (event.changedTouches?.[0]?.clientY ?? 0) : (event as MouseEvent).clientY;

      /* v32：根据 previewState 决定行为 */
      if (wasPreview === "blocked" && wasHoverId) {
        /* 不可连：v32.5 —— 若只是"已存在连线"（多半是隐形旧边），直接替换修复；其他原因弹 toast */
        if (wasHoverId && wasError === "已存在连线") {
          addEdgeDedup(start.nodeId!, wasHoverId);
          return;
        }
        showConnectError(wasError ?? "无法连接到该节点");
        return;
      }
      if (wasPreview === "connectable" && wasHoverId) {
        /* 可连：直接连 + success 动画 + 目标节点闪光 */
        addEdgeDedup(start.nodeId!, wasHoverId);
        return;
      }

      /* v31：检测松手点是否压到任意节点 —— 通过 :hover 取得 React Flow 已缓存的命中节点 */
      const hovered = document.querySelectorAll(".react-flow__node:hover");
      let targetNodeId: string | null = null;
      hovered.forEach((el) => {
        const nodeEl = el as HTMLElement;
        /* 排除源节点本身 */
        if (!nodeEl.dataset?.id) return;
        if (nodeEl.dataset.id === start.nodeId) return;
        targetNodeId = nodeEl.dataset.id;
      });
      /* 兜底：如果 :hover 没拿到，用 document.elementFromPoint 找 */
      if (!targetNodeId) {
        const underEl = document.elementFromPoint(clientX, clientY);
        if (underEl) {
          const nodeEl = underEl.closest(".react-flow__node") as HTMLElement | null;
          if (nodeEl?.dataset?.id && nodeEl.dataset.id !== start.nodeId) {
            targetNodeId = nodeEl.dataset.id;
          }
        }
      }

      if (targetNodeId) {
        /* 落在已有节点上 → 直接连（绕开 strict + connectionRadius 的 18px 限制；v32.5 dedup 修复隐形旧边） */
        addEdgeDedup(start.nodeId!, targetNodeId);
        return;
      }

      /* 落在 pane 上 → 弹菜单让用户挑新建节点类型 */
      const flowPos = screenToFlowPosition({ x: clientX, y: clientY });
      setConnectMenu({
        sourceNodeId: start.nodeId,
        flowPos,
        clientPos: { x: clientX, y: clientY },
      });
    },
    [screenToFlowPosition, hoverTargetId, previewState, connectError, showConnectError, addEdgeDedup],
  );

  /* v29：从「引用该节点生成」菜单中挑一个类型创建节点并连线 */
  const addNodeFromConnect = useCallback(
    (kind: "text" | "image" | "video") => {
      if (!connectMenu) return;
      const newId = nextNodeId();
      const { flowPos, sourceNodeId } = connectMenu;
      const meta = (() => {
        if (kind === "text")
          return {
            type: "text",
            data: { nodeKind: "text", title: "新文本节点", text: "双击编辑内容…" } satisfies TextNodeData,
          };
        if (kind === "image")
          return {
            type: "image",
            data: {
              nodeKind: "image",
              kind: "image",
              title: "图片节点",
              category: "图片",
              tint: "rgba(212, 83, 126, 0.18)",
              size: { w: 300, h: 200 },
            } satisfies ImageNodeData,
          };
        return {
          type: "video",
          data: {
            nodeKind: "video",
            title: "视频节点",
            category: "视频",
            tint: "rgba(55, 138, 221, 0.20)",
            size: { w: 300, h: 200 },
          } satisfies VideoNodeData,
        };
      })();
      setNodes((ns) => [
        ...ns,
        {
          id: newId,
          type: meta.type,
          /* v37：新节点左边缘对齐线尾（松手点），节点出现在连线末端右侧 */
          position: { x: flowPos.x, y: flowPos.y - 60 },
          data: meta.data,
        },
      ]);
      setEdges((es) => [
        ...es,
        {
          id: `e_${Date.now()}`,
          source: sourceNodeId,
          target: newId,
          type: "default",
          style: { stroke: "#7f7f86", strokeWidth: 1.6 },
        },
      ]);
      setConnectMenu(null);
    },
    [connectMenu, setNodes, setEdges],
  );

  /* v38：Agent 抽屉提交 —— 追加用户气泡 + Agent 占位回复（后续接真 API） */
  const submitChat = useCallback(() => {
    if (!chatInput.trim() && !chatThumb) return;
    const userText = chatInput.trim();
    setAgentMessages((ms) => [
      ...ms,
      { role: "user", text: userText || "（图片）", thumb: chatThumb },
      { role: "agent", text: "已收到你的指令。编排能力即将上线，我会根据画布内容生成对应节点。" },
    ]);
    setChatInput("");
    setChatThumb(null);
  }, [chatInput, chatThumb]);

  /* chat 缩略上传（占位：DataURL） */
  const handleThumb = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setChatThumb(String(reader.result));
  }, []);

  /* 顶部 NodeToolbar：根据选中节点的 kind 决定工具胶囊列表（text 基础节点给编辑类工具） */
  const selData = selectedNode?.data as AnyNodeData | undefined;
  const selectedKind: NodeKind = selData && "kind" in selData && selData.kind ? selData.kind : "llm";
  const toolbarItems: { label: string; icon: React.ReactNode }[] = NODE_TOOLBAR[selectedKind] ?? NODE_TOOLBAR.llm ?? [];

  return (
    <EnterEditContext.Provider
      value={{
        editingId,
        editingKind: editingId
          ? (((nodes.find((n) => n.id === editingId)?.data as Record<string, unknown> | undefined)?.nodeKind as
              string | undefined) ?? null)
          : null,
        buffer: editBuffer,
        setBuffer: setEditBuffer,
        enterEdit,
        saveEdit,
        commitEdit,
        commitImageEdit,
        commitVideoEdit,
        exitEdit,
        focusMode: { nodeId: editingId },
        onApplyFormat,
        editorElRef,
        composingRef,
        imageEditStateRef,
        videoEditStateRef,
      }}
    >
      <div className={styles.shell}>
        {/* v39 顶部栏：积分（悬停弹窗）+ Agent 圆头像并列右上角 */}
        <div className={styles.topbar}>
          <div className={styles.topbarLeft} />
          <div className={styles.topbarRight}>
            <div className={styles.creditWrap} onMouseEnter={openCredit} onMouseLeave={closeCredit}>
              <button className={styles.creditPill} title="积分">
                <Coins size={12} />
                100
              </button>
              {creditHover && (
                <div className={styles.creditPopover} onMouseEnter={openCredit} onMouseLeave={closeCredit}>
                  <div className={styles.creditMemberCard}>
                    <Coins size={14} className={styles.creditMemberIcon} />
                    <span className={styles.creditMemberLabel}>个人非会员</span>
                    <button className={styles.creditMemberBtn}>开通会员</button>
                  </div>
                  <div className={styles.creditBalanceRow}>
                    <span className={styles.creditBalanceLabel}>
                      积分余额：<b>100点</b>
                    </span>
                    <button className={styles.creditRecharge}>充值</button>
                  </div>
                  <div className={styles.creditDetailList}>
                    <div className={styles.creditDetailRow}>
                      <span>会员订阅积分</span>
                      <span>0点</span>
                    </div>
                    <div className={styles.creditDetailRow}>
                      <span>通用充值积分</span>
                      <span>0点</span>
                    </div>
                    <div className={styles.creditDetailRow}>
                      <span>模型卡积分</span>
                      <span>0点</span>
                    </div>
                    <div className={styles.creditDetailRow}>
                      <span>免费积分</span>
                      <span>100点</span>
                    </div>
                  </div>
                  <div className={styles.creditMenuSep} />
                  <div className={styles.creditMenuList}>
                    <button className={styles.creditMenuItem} onClick={() => toast("订阅管理：即将上线", "info")}>
                      <span>订阅管理</span>
                      <ChevronRight size={13} />
                    </button>
                    <button className={styles.creditMenuItem} onClick={() => toast("积分管理：即将上线", "info")}>
                      <span>积分管理</span>
                      <ChevronRight size={13} />
                    </button>
                    <button
                      className={styles.creditMenuItem}
                      onClick={() => toast("积分消耗顺序设置：即将上线", "info")}
                    >
                      <span>积分消耗顺序设置</span>
                      <ChevronRight size={13} />
                    </button>
                    <button className={styles.creditMenuItem} onClick={() => toast("联系客服：即将上线", "info")}>
                      <span>联系客服</span>
                      <ChevronRight size={13} />
                    </button>
                  </div>
                </div>
              )}
            </div>
            <button
              ref={agentBtnRef}
              className={`${styles.agentAvatarBtn} ${agentOpen ? styles.agentAvatarBtnActive : ""}`}
              title="织光 Agent"
              aria-label="织光 Agent"
              onClick={() => setAgentOpen((v) => !v)}
            >
              <Bot size={15} />
            </button>
          </div>
        </div>

        {/* v38：Agent 右侧抽屉 —— 气泡式对话 */}
        {agentOpen && (
          <div ref={agentDrawerRef} className={styles.agentDrawer}>
            <div className={styles.agentDrawerHead}>
              <div className={styles.agentDrawerHeadLeft}>
                <div className={styles.agentDrawerAvatar}>
                  <Bot size={13} />
                </div>
                <div className={styles.agentDrawerTitle}>
                  <span className={styles.agentDrawerName}>织光 Agent</span>
                  <span className={styles.agentDrawerModel}>✦ {chatModel}</span>
                </div>
              </div>
              <button className={styles.agentDrawerClose} onClick={() => setAgentOpen(false)} aria-label="收起">
                <X size={13} />
              </button>
            </div>
            <div className={styles.agentDrawerMessages}>
              {agentMessages.map((m, i) => (
                <div
                  key={i}
                  className={`${styles.agentBubbleRow} ${m.role === "user" ? styles.agentBubbleRowUser : ""}`}
                >
                  {m.thumb && <img src={m.thumb} alt="参考图" className={styles.agentBubbleThumb} />}
                  <div className={`${styles.agentBubble} ${m.role === "user" ? styles.agentBubbleUser : ""}`}>
                    {m.text}
                  </div>
                </div>
              ))}
            </div>
            <div className={styles.agentDrawerInputRow}>
              <label className={styles.chatPlus} title="添加参考图">
                <Plus size={14} />
                <input type="file" accept="image/*" hidden onChange={handleThumb} />
              </label>
              {chatThumb && (
                <div className={styles.chatThumb}>
                  <img src={chatThumb} alt="参考图" />
                  <button className={styles.chatThumbClose} onClick={() => setChatThumb(null)} aria-label="移除">
                    <X size={10} />
                  </button>
                </div>
              )}
              <input
                className={styles.agentDrawerInput}
                placeholder="告诉 Agent 想做什么…"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submitChat();
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    setAgentOpen(false);
                  }
                }}
              />
              <button
                className={`${styles.chatSend} ${chatInput.trim() || chatThumb ? styles.chatSendActive : ""}`}
                onClick={submitChat}
                disabled={!chatInput.trim() && !chatThumb}
                title="发送"
              >
                <Send size={13} />
              </button>
            </div>
          </div>
        )}

        {/* 选中节点的浮出工具胶囊（按 LibTV 模式） */}
        {selectedNode && !editingId && (
          <div className={styles.nodeToolbar}>
            {toolbarItems.map((t) => (
              <button key={t.label} className={styles.nodeToolbarItem}>
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>
        )}

        {/* v7：聚焦编辑浮层（顶部格式化工具栏；v10 移除左侧完成/取消面板 —— 点击外部自动保存） */}
        <FloatingToolbar />

        {/* v34：图片节点编辑栏 — 由 Portal 挂到 body，屏宽 40%，距屏底 16px，水平居中对齐当前编辑节点 */}
        <ImageEditPanel />
        {/* v34.2：视频节点编辑栏 — 同款外置方案 + 5 chip + 视频字段 */}
        <VideoEditPanel />

        {/* 画布主区 */}
        <div className={styles.board}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onSelectionChange={onSelectionChange}
            onPaneContextMenu={onPaneContextMenu}
            onPaneClick={() => {
              setContextMenu(null);
              setConnectMenu(null);
            }}
            onMoveStart={() => {
              setContextMenu(null);
              setConnectMenu(null);
            }}
            /* v13：节点之间连线 / 从 source 拖到空白处创建新节点 */
            onConnect={onConnect}
            onConnectStart={onConnectStart}
            onConnectEnd={onConnectEnd}
            isValidConnection={isValidConnection}
            /* v28：strict 模式 —— 只在松手落在明确的 handle 上才算连接（否则默认按就近 handle 误连） */
            connectionMode={ConnectionMode.Strict}
            connectionRadius={18}
            nodeTypes={nodeTypes}
            fitView
            minZoom={0.3}
            maxZoom={2.5}
            /* v16：Mac 触控板原生手势 —— 双指滚动=平移画布，捏合(ctrl+wheel)=缩放；
             编辑器容器加 nowheel 后，在节点内滚动不再带动画布 */
            panOnScroll
            zoomOnScroll={false}
            zoomOnPinch
            /* v32：连接线样式由全局 :global(.react-flow__connection-path) 控制（默认 connectable 态） */
            proOptions={{ hideAttribution: true }}
            className={styles.flowRoot}
          >
            <Background variant={BackgroundVariant.Dots} gap={24} size={1} className={styles.bg} />
            <Controls showInteractive={false} className={styles.controls} />
            <MiniMap pannable zoomable className={styles.minimap} maskColor="rgba(13, 13, 15, 0.7)" />
          </ReactFlow>

          {/* v32：连线失败 toast */}
          {connectError && (
            <div className={styles.connectError} role="alert">
              <X size={12} />
              <span>无法连接：{connectError}</span>
            </div>
          )}

          {/* 右键菜单：3 类基础节点 */}
          {contextMenu && (
            <div className={styles.contextMenu} style={{ left: contextMenu.x, top: contextMenu.y }}>
              <div className={styles.contextMenuHead}>添加节点</div>
              <button className={styles.contextMenuItem} onClick={() => addBasicNode("text", contextMenu.flowPos)}>
                <TypeIcon size={13} />
                文本
              </button>
              <button className={styles.contextMenuItem} onClick={() => addBasicNode("image", contextMenu.flowPos)}>
                <ImageIcon size={13} />
                图片
              </button>
              <button className={styles.contextMenuItem} onClick={() => addBasicNode("video", contextMenu.flowPos)}>
                <VideoIcon size={13} />
                视频
              </button>
            </div>
          )}

          {/* v29：从节点拖线到空白处 → 弹「引用该节点生成」菜单 */}
          {connectMenu && (
            <div
              className={styles.contextMenu}
              style={{ left: connectMenu.clientPos.x, top: connectMenu.clientPos.y, minWidth: 220 }}
            >
              <div className={styles.contextMenuHead}>引用该节点生成</div>
              <button className={styles.contextMenuItem} onClick={() => addNodeFromConnect("text")}>
                <TypeIcon size={13} />
                文本
              </button>
              <button className={styles.contextMenuItem} onClick={() => addNodeFromConnect("image")}>
                <ImageIcon size={13} />
                图片
              </button>
              <button className={styles.contextMenuItem} onClick={() => addNodeFromConnect("video")}>
                <VideoIcon size={13} />
                视频
              </button>
              <div className={styles.contextMenuSep} />
              <button className={styles.contextMenuItem} disabled title="即将上线">
                <Sparkles size={13} />
                智能剪辑
                <span className={styles.contextMenuBadge}>Beta</span>
              </button>
              <button className={styles.contextMenuItem} disabled title="即将上线">
                <Film size={13} />
                导演台
                <span className={`${styles.contextMenuBadge} ${styles.contextMenuBadgeNew}`}>NEW</span>
              </button>
              <button className={styles.contextMenuItem} disabled title="即将上线">
                <Layers size={13} />
                逐帧拉片
                <span className={styles.contextMenuBadge}>SD 2.5</span>
              </button>
              <div className={styles.contextMenuSep} />
              <button className={styles.contextMenuItem} disabled title="即将上线">
                <Music size={13} />
                音频
              </button>
              <button className={styles.contextMenuItem} disabled title="即将上线">
                <FileText size={13} />
                脚本
              </button>
              <button className={styles.contextMenuItem} disabled title="即将上线">
                <Link2 size={13} />
                参考节点
              </button>
            </div>
          )}

          {nodes.length === 0 && (
            <div className={styles.guide}>
              <div className={styles.guideBubble}>
                <div className={styles.guideTitle}>右键画布 · 添加节点</div>
                <div className={styles.guideSub}>文本 / 图片 / 视频，也可从节点 handle 拖出连线</div>
              </div>
              <button className={styles.guideLoad} onClick={() => void loadFromLatest()} disabled={!hasRun}>
                <RefreshCw size={14} />
                {hasRun ? "从最近任务加载" : "暂无已完成任务"}
              </button>
            </div>
          )}
        </div>

        {/* 底部：5 个工具图标（简化版） + 中央 chat-bar */}
        {/* v38 底部：仅左下角 + 圆角块（点击弹节点菜单），其余工具与聊天栏全部移除 */}
        <div className={styles.bottomLeftDock}>
          <div className={styles.addWrap}>
            <button
              ref={addFabBtnRef}
              className={`${styles.addFab} ${showAddMenu ? styles.addFabActive : ""}`}
              title="添加节点"
              onClick={() => {
                setShowAddMenu((v) => !v);
                setShowLibrary(false);
              }}
            >
              <Plus size={16} />
            </button>
            {showAddMenu && (
              <div ref={addMenuRef} className={styles.addMenu}>
                <div className={styles.contextMenuHead}>基础节点</div>
                <button
                  className={styles.contextMenuItem}
                  onClick={() => {
                    addBasicNode("text");
                    setShowAddMenu(false);
                  }}
                >
                  <TypeIcon size={13} />
                  文本
                </button>
                <button
                  className={styles.contextMenuItem}
                  onClick={() => {
                    addBasicNode("image");
                    setShowAddMenu(false);
                  }}
                >
                  <ImageIcon size={13} />
                  图片
                </button>
                <button
                  className={styles.contextMenuItem}
                  onClick={() => {
                    addBasicNode("video");
                    setShowAddMenu(false);
                  }}
                >
                  <VideoIcon size={13} />
                  视频
                </button>
                <div className={styles.addMenuSep} />
                <button
                  className={styles.contextMenuItem}
                  onClick={() => {
                    setShowLibrary(true);
                    setShowAddMenu(false);
                  }}
                >
                  <Sparkles size={13} />
                  业务能力…
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 节点库弹层（基础节点 + 业务能力双区） */}
        {showLibrary && (
          <div className={styles.libraryBackdrop} onClick={() => setShowLibrary(false)}>
            <div ref={libraryRef} className={styles.library} onClick={(e) => e.stopPropagation()}>
              <div className={styles.libraryHead}>
                <span>节点库</span>
                <button onClick={() => setShowLibrary(false)} aria-label="关闭">
                  <X size={14} />
                </button>
              </div>

              {/* 基础节点区 */}
              <div className={styles.librarySectionLabel}>基础节点</div>
              <div className={styles.basicGrid}>
                <button
                  className={styles.basicItem}
                  onClick={() => {
                    addBasicNode("text");
                    setShowLibrary(false);
                  }}
                >
                  <div className={styles.basicIcon}>
                    <TypeIcon size={16} />
                  </div>
                  <span>文本</span>
                  <span className={styles.basicHint}>记录想法 / 说明</span>
                </button>
                <button
                  className={styles.basicItem}
                  onClick={() => {
                    addBasicNode("image");
                    setShowLibrary(false);
                  }}
                >
                  <div className={`${styles.basicIcon} ${styles.basicImage}`}>
                    <ImageIcon size={16} />
                  </div>
                  <span>图片</span>
                  <span className={styles.basicHint}>上传或生成</span>
                </button>
                <button
                  className={styles.basicItem}
                  onClick={() => {
                    addBasicNode("video");
                    setShowLibrary(false);
                  }}
                >
                  <div className={`${styles.basicIcon} ${styles.basicVideo}`}>
                    <VideoIcon size={16} />
                  </div>
                  <span>视频</span>
                  <span className={styles.basicHint}>上传或生成</span>
                </button>
              </div>

              <div className={styles.librarySectionLabel} style={{ marginTop: 14 }}>
                业务能力
              </div>
              <div className={styles.libraryGrid}>
                {NODE_LIBRARY.map((lib, i) => {
                  const meta = KIND_META[lib.kind];
                  return (
                    <button
                      key={i}
                      className={styles.libraryItem}
                      onClick={() => addFromLibrary(i)}
                      style={{ borderColor: meta.color.stroke, background: meta.color.bg }}
                    >
                      <div className={styles.libraryTop}>
                        <span
                          className={styles.libraryCategory}
                          style={{ color: meta.color.text, background: meta.color.stroke + "33" }}
                        >
                          {lib.category}
                        </span>
                        <span className={styles.libraryType} style={{ color: meta.color.text }}>
                          {lib.title}
                        </span>
                      </div>
                      <span className={styles.libraryMeta} style={{ color: meta.color.soft }}>
                        {lib.meta}
                      </span>
                      {lib.nodeKind === "card" && (
                        <div className={styles.libraryFields}>
                          {lib.fields.slice(0, 3).map((f, j) => (
                            <div key={j} className={styles.libraryField}>
                              <span className={styles.libraryFieldLabel}>{f.label}</span>
                              <span className={styles.libraryFieldValue}>{f.value}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
      );
    </EnterEditContext.Provider>
  );
}

export default function CanvasPage() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
}
