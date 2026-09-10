"use client";

import React, { useCallback, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Handle, Position, useStore, type NodeProps } from "@xyflow/react";
import { CheckCircle2, ChevronDown, FileText, Film, Image as ImageIcon, ImagePlus, Layers, Maximize2, MonitorPlay, Palette, RefreshCw, Send, Share2, SlidersHorizontal, Sparkles, Tag, Type as TypeGlyph, Type as TypeIcon, Upload, User as UserIcon, Video as VideoIcon, Volume2, X, Zap } from "lucide-react";
import { toast } from "@/hooks/useToast";
import { EnterEditContext } from "@/features/canvas/editContext";
import { KIND_META } from "@/features/canvas/types/kindMeta";
import type { CardNodeData, ImageNodeData, TextNodeData, VideoNodeData } from "@/features/canvas/types/nodes";
import styles from "@/app/canvas/page.module.scss";

/**
 * 渲染卡片节点通用的 Markdown 文本编辑器。
 *
 * @param props - 编辑器初始内容、视觉强调色与保存/取消回调。
 */
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

/**
 * 渲染结构化卡片节点，并在双击后切换为通用节点编辑器。
 *
 * @param props - React Flow 注入的节点属性。
 */
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

/**
 * 渲染图片节点在浏览态和编辑态共用的卡片主体。
 *
 * @param props - 图片数据、预览地址、文件选择回调与编辑状态。
 */
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

  /** 默认态图生图：选中文件直接写回节点 url（不进编辑态） */
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
            {/* eslint-disable-next-line @next/next/no-img-element */}
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
        {/* 左下角双入口 chip（图生图 / 图片高清） */}
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

/**
 * 渲染 React Flow 图片节点，并根据编辑上下文切换展示状态。
 *
 * @param props - React Flow 注入的节点属性。
 */
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

/**
 * 浅比较两个扁平对象，避免 React Flow 视口选择器产生无效更新。
 *
 * @param a - 前一次选择器结果。
 * @param b - 当前选择器结果。
 * @returns 所有一级键和值是否一致。
 */
function shallowEqual(a: Record<string, unknown>, b: Record<string, unknown>) {
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  for (const k of ka) if (a[k] !== b[k]) return false;
  return true;
}

/**
 * 通过 Portal 在视口底部渲染当前图片节点的生成参数面板。
 *
 * @returns 当前节点不是图片时返回 `null`，否则返回图片编辑面板。
 */
export function ImageEditPanel() {
  const edit = useContext(EnterEditContext);
  const rf = useStore((s) => ({ tx: s.transform[0], ty: s.transform[1], zoom: s.transform[2] }), shallowEqual);

  /** 当前编辑的图片节点（editingId）—— 字段初值取自节点的 data */
  const editingId = edit.editingId;
  const node = useStore((s) => (editingId ? (s.nodes.find((n) => n.id === editingId) ?? null) : null));
  const data = (node?.data as unknown as ImageNodeData | undefined) ?? null;
  /** 只渲染图片节点编辑栏（视频节点由 VideoEditPanel 渲染）。
     所有 hooks 必须在 early return 之前固定调用（Rules of Hooks） */
  const isImage = (data as unknown as { nodeKind?: string } | undefined)?.nodeKind === "image";

  const [prompt, setPrompt] = useState(data?.prompt ?? "");
  const [ratio, setRatio] = useState(data?.ratio ?? "1:1");
  const [quality, setQuality] = useState(data?.quality ?? "标准");
  const [count, setCount] = useState(data?.count ?? 1);
  const [model, setModel] = useState(data?.model ?? "Weavl Image");
  const [showRatioMenu, setShowRatioMenu] = useState(false);
  const [showModelMenu, setShowModelMenu] = useState(false);

  /** 节点变更（切到不同图片节点编辑）时同步字段初值 */
  useEffect(() => {
    if (!data) return;
    setPrompt(data.prompt ?? "");
    setRatio(data.ratio ?? "1:1");
    setQuality(data.quality ?? "标准");
    setCount(data.count ?? 1);
    setModel(data.model ?? "Weavl Image");
  }, [edit.editingId, data]);

  /** 实时同步到 imageEditStateRef，供外部 commitEdit / commitImageEdit 取最新值 */
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

  /** 发送：写入节点 data，保留编辑栏在屏上的同时更新预览（提示用户"已生成"）—— 简化：直接退出编辑态 */
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

  /** -------- 居中算法：拖动性能优化 --------
   关键改进：
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
      /** 仅在变化时写 DOM（避免无谓 reflow） */
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

  /** 去掉飞入动画 —— 始终 opacity:1，compute() 失败也不影响可见性 */
  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    el.style.opacity = "1";
  }, [edit.editingId]);

  /** 只在编辑图片节点时渲染（early return 必须在所有 hooks 之后） */
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

/**
 * 渲染图片节点编辑态的卡片，并初始化外置编辑面板所需的共享状态。
 *
 * @param props - 当前图片节点标识与数据。
 */
function ImageNodeEditor({ id, data }: { id: string; data: ImageNodeData }) {
  const edit = useContext(EnterEditContext);
  /** 编辑栏已外置，节点的 imageEditStateRef 由外层 ImageEditPanel 维护。
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

/**
 * 渲染 React Flow 文本节点，并根据编辑上下文切换展示状态。
 *
 * @param props - React Flow 注入的节点属性。
 */
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

/**
 * 渲染基于 contentEditable 的文本节点编辑器。
 *
 * @remarks
 * 文本由 DOM 自行维护，并在提交时同步到编辑缓冲区，避免输入期间因 React
 * 重渲染导致光标跳转；IME 组合输入期间不会同步缓冲区。
 *
 * @param props - 当前文本节点数据。
 */
function TextNodeEditor({ data }: { data: TextNodeData }) {
  const edit = useContext(EnterEditContext);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const initialTextRef = useRef(edit.buffer.text);

  /** 挂载：buffer.text 写一次到 DOM，光标放到末尾 */
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

  /** 把 DOM 当前文本同步进 buffer（仅在不在 IME composition 时调用） */
  const syncBufferFromDOM = useCallback(() => {
    if (!editorRef.current) return;
    if (edit.composingRef.current) return;
    const text = editorRef.current.innerText || "";
    edit.setBuffer({ title: edit.buffer.title, text });
  }, [edit]);

  /** 卸载：清理 ref */
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
        /** 不在这里放 {text} children —— DOM 自己维护，避免 React 重置光标 */
        onCompositionStart={() => {
          edit.composingRef.current = true;
        }}
        onCompositionEnd={() => {
          edit.composingRef.current = false;
          syncBufferFromDOM();
        }}
        onInput={() => {
          /** 不在每次按键时 setBuffer，避免 React 重置光标；
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

/**
 * 渲染视频节点在浏览态和编辑态共用的卡片主体。
 *
 * @param props - 视频数据、预览地址、文件选择回调与编辑状态。
 */
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
  /** 视频节点默认尺寸与图片节点保持一致（300×200） */
  const w = d.size?.w ?? 300;
  const h = d.size?.h ?? 200;
  const displayTitle = d.title || "视频节点";
  const url = overrideUrl ?? d.url;
  const fileRef = useRef<HTMLInputElement | null>(null);

  /** 默认态上传视频：直接写回节点 url（不进编辑态） */
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
        {/* 左下角 chip ——「尝试：↻」+ 三个常用能力 */}
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

/**
 * 渲染 React Flow 视频节点，并根据编辑上下文切换展示状态。
 *
 * @param props - React Flow 注入的节点属性。
 */
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

/**
 * 通过 Portal 在视口底部渲染当前视频节点的生成参数面板。
 *
 * @returns 当前节点不是视频时返回 `null`，否则返回视频编辑面板。
 */
export function VideoEditPanel() {
  const edit = useContext(EnterEditContext);
  const rf = useStore((s) => ({ tx: s.transform[0], ty: s.transform[1], zoom: s.transform[2] }), shallowEqual);
  const editingId = edit.editingId;
  const node = useStore((s) => (editingId ? (s.nodes.find((n) => n.id === editingId) ?? null) : null));
  const data = (node?.data as unknown as VideoNodeData | undefined) ?? null;
  const isVideo = (data as unknown as { nodeKind?: string } | undefined)?.nodeKind === "video";

  /** 所有 hooks 必须在 return 之前固定调用（Rules of Hooks） */
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
  /** 移除飞入动画 —— 挂载时透明，首次定位后立即显示（无位移过渡） */
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
  /** 只在编辑视频节点时渲染（early return 必须在所有 hooks 之后） */
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

/**
 * 渲染视频节点编辑态的卡片，并初始化外置编辑面板所需的共享状态。
 *
 * @param props - 当前视频节点标识与数据。
 */
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

/** React Flow 使用的画布节点类型注册表。 */
export const nodeTypes = { card: CardNode, image: ImageNode, text: TextNode, video: VideoNode };
