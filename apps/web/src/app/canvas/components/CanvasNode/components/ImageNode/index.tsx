"use client";

import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Handle, Position, useStore, type NodeProps } from "@xyflow/react";
import { ChevronDown, Image as ImageIcon, ImagePlus, Maximize2, MonitorPlay, Palette, RefreshCw, Send, SlidersHorizontal, Sparkles, Tag, Upload, Zap } from "lucide-react";
import { EnterEditContext } from "../../../../editContext";
import { KIND_META } from "../../../../types/kindMeta";
import type { ImageNodeData } from "../../../../types/nodes";
import sharedStyles from "../../index.module.scss";
import localStyles from "./index.module.scss";

const styles = { ...sharedStyles, ...localStyles };

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
      <div data-canvas-node-surface className={styles.imageNode} style={{ width: w, height: h }} onDoubleClick={onDoubleClick}>
        <Handle type="target" position={Position.Left} className={styles.cardHandle} />
        {/* 已有图则显示真图，否则占位渐变 */}
        {url ? (
          <div className={styles.imagePreview}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={d.title} className={styles.imageReal} />
          </div>
        ) : (
          <div className={`${styles.imagePreview} ${styles.emptyMediaPreview}`}>
            <div className={styles.imagePlaceholder}>{meta.icon}</div>
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
export function ImageNode({ data, id }: NodeProps) {
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
 * 通过 Portal 在视口底部渲染当前图片节点的生成参数面板。
 *
 * @returns 当前节点不是图片时返回 `null`，否则返回图片编辑面板。
 */
export function ImageEditPanel() {
  const edit = useContext(EnterEditContext);
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
    if (!isImage) return;

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
  }, [isImage, node]);

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
      <div className={styles.imageEditBarHead}>
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
