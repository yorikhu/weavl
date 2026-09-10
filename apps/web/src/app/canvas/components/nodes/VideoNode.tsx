"use client";

import React, { useCallback, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Handle, Position, useStore, type NodeProps } from "@xyflow/react";
import { ChevronDown, FileText, Film, ImagePlus, Layers, Maximize2, MonitorPlay, RefreshCw, Send, Share2, Sparkles, Tag, Type as TypeGlyph, User as UserIcon, Video as VideoIcon, Volume2, Zap } from "lucide-react";
import { EnterEditContext } from "../../editContext";
import type { VideoNodeData } from "../../types/nodes";
import styles from "../../page.module.scss";
import { shallowEqual } from "./utils";

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
export function VideoNode({ data, id }: NodeProps) {
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
