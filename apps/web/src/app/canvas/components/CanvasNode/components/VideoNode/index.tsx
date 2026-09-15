"use client";

import React, { useCallback, useContext, useEffect, useRef, useState } from "react";
import { Handle, Position, useReactFlow, useStore, type NodeProps } from "@xyflow/react";
import {
  ChevronDown,
  Film,
  ImagePlus,
  Layers,
  Maximize2,
  RefreshCw,
  Sparkles,
  Tag,
  User as UserIcon,
  Video as VideoIcon,
} from "lucide-react";
import { MediaSettingsControl } from "../../../MediaSettingsControl";
import { NodePromptPanel } from "../../../NodePromptPanel";
import { EnterEditContext } from "../../../../editContext";
import { EditableNodeTitle } from "../../../EditableNodeTitle";
import type { VideoNodeData } from "../../../../types/nodes";
import {
  getMediaCardSize,
  getMediaDimensions,
  type MediaDimensionOption,
} from "../../../../utils/mediaSizing";
import sharedStyles from "../../index.module.scss";

const styles = sharedStyles;

/**
 * 渲染视频节点在浏览态和编辑态共用的卡片主体。
 *
 * @param props - 视频数据、预览地址、文件选择回调与编辑状态。
 */
function VideoCardStatic({
  d,
  nodeId,
  onActivate,
  editing = false,
}: {
  d: VideoNodeData;
  nodeId?: string;
  onActivate?: () => void;
  editing?: boolean;
}) {
  const edit = useContext(EnterEditContext);
  /** 视频节点默认尺寸与图片节点保持一致（300×200） */
  const w = d.size?.w ?? 300;
  const h = d.size?.h ?? 200;
  const displayTitle = d.title || "视频节点";
  const url = d.url;

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
          nodeId ? <EditableNodeTitle nodeId={nodeId} value={d.title} fallback="视频节点" /> : <span>{displayTitle}</span>
        )}
      </div>
      <div
        data-canvas-node-surface
        className={styles.imageNode}
        style={{ width: w, height: h }}
        onClick={(event) => {
          if (!(event.target as Element).closest(".react-flow__handle")) onActivate?.();
        }}
      >
        <Handle type="target" position={Position.Left} className={styles.cardHandle} />
        {/* 已有视频则显示视频预览，否则仅显示中性占位图标。 */}
        {url ? (
          <div className={styles.imagePreview}>
            <video src={url} className={styles.imageReal} muted preload="metadata" />
          </div>
        ) : (
          <div className={`${styles.imagePreview} ${styles.emptyMediaPreview}`}>
            <div className={styles.imagePlaceholder}>
              <VideoIcon size={16} />
            </div>
          </div>
        )}
        <Handle type="source" position={Position.Right} className={styles.cardHandle} />
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
    return <VideoNodeEditor data={d} />;
  }

  return (
    <div className={styles.imageNodeWrap}>
      <VideoCardStatic d={d} nodeId={id} onActivate={() => edit.enterEdit(id)} />
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
  const { setNodes } = useReactFlow();
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
  const [showRefMenu, setShowRefMenu] = useState(false);
  const syncedNodeIdRef = useRef<string | null>(null);
  const dimensions = getMediaDimensions("video", model);
  const selectedDimension = dimensions.find((item) => item.ratio === ratio) ?? dimensions[0];
  useEffect(() => {
    if (!editingId) {
      syncedNodeIdRef.current = null;
      return;
    }
    if (!data) return;
    if (syncedNodeIdRef.current === editingId) return;
    setPrompt(data.prompt ?? "");
    setRatio(data.ratio ?? "16:9");
    setQuality(data.quality ?? "720P");
    setDuration(data.duration ?? 5);
    setCount(data.count ?? 1);
    setModel(data.model ?? "Weavl Video");
    syncedNodeIdRef.current = editingId;
  }, [editingId, data]);
  const changeDimension = useCallback(
    (nextDimension: MediaDimensionOption) => {
      setRatio(nextDimension.ratio);
      if (!editingId) return;
      const nextSize = getMediaCardSize(nextDimension);
      setNodes((currentNodes) =>
        currentNodes.map((currentNode) => {
          if (currentNode.id !== editingId) return currentNode;
          const currentData = currentNode.data as unknown as VideoNodeData;
          return {
            ...currentNode,
            data: {
              ...currentData,
              ratio: nextDimension.ratio,
              generationSize: { width: nextDimension.width, height: nextDimension.height },
              size: nextSize,
            },
          };
        }),
      );
    },
    [editingId, setNodes],
  );
  const changeModel = useCallback(
    (nextModel: string) => {
      setModel(nextModel);
      const nextDimensions = getMediaDimensions("video", nextModel);
      if (!nextDimensions.some((item) => item.ratio === ratio) && nextDimensions[0]) {
        changeDimension(nextDimensions[0]);
      }
    },
    [changeDimension, ratio],
  );
  useEffect(() => {
    edit.videoEditStateRef.current = {
      prompt,
      ratio,
      quality,
      duration,
      count,
      model,
      generationSize: selectedDimension
        ? { width: selectedDimension.width, height: selectedDimension.height }
        : undefined,
      title: edit.buffer.title,
    };
  }, [prompt, ratio, quality, duration, count, model, selectedDimension, edit]);
  const onGenerate = useCallback(() => {
    if (!edit.editingId) return;
    edit.commitVideoEdit?.(edit.editingId, {
      prompt,
      ratio,
      quality,
      duration,
      count,
      model,
      generationSize: selectedDimension
        ? { width: selectedDimension.width, height: selectedDimension.height }
        : undefined,
      title: undefined,
    });
  }, [edit, prompt, ratio, quality, duration, count, model, selectedDimension]);
  const modelOptions = ["Weavl Video", "Lib Video", "Sora", "Veo"];
  const refOptions = ["全能参考", "人脸参考", "首尾帧", "角色一致性"];
  const cost = count * (quality === "2K" ? 60 : quality === "720P" ? 27 : 18);
  if (!edit.editingId || !isVideo) return null;

  return (
    <NodePromptPanel
      nodeId={edit.editingId}
      prompt={prompt}
      placeholder="描述想生成的视频画面、动作与节奏，或引用已有素材…"
      model={model}
      models={modelOptions.map((item) => ({ id: item, label: item }))}
      modelMenuLabel="视频模型"
      cost={cost}
      rows={3}
      header={
        <div className={styles.imageEditBarHead}>
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
      }
      footerMiddle={
        <>
          <span className={styles.imageEditParamSep} />
          <div className={styles.imageEditRatioWrap}>
            <button
              className={styles.imageEditParam}
              onClick={() => {
                setShowRefMenu((open) => !open);
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
                {refOptions.map((item) => (
                  <button
                    key={item}
                    className={`${styles.imageEditRatioItem} ${item === refType ? styles.imageEditRatioItemActive : ""}`}
                    onClick={() => {
                      setRefType(item);
                      setShowRefMenu(false);
                    }}
                  >
                    {item}
                  </button>
                ))}
              </div>
            )}
          </div>
          <span className={styles.imageEditParamSep} />
          <MediaSettingsControl
            open={showRatioMenu}
            ratio={ratio}
            dimensions={dimensions}
            quality={quality}
            qualities={["480P", "720P", "2K"]}
            qualityLabel="清晰度"
            duration={duration}
            durations={[3, 5, 10]}
            count={count}
            counts={[1, 2, 4]}
            countUnit="个"
            onOpenChange={(open) => {
              setShowRatioMenu(open);
              if (open) setShowRefMenu(false);
            }}
            onDimensionChange={changeDimension}
            onQualityChange={setQuality}
            onDurationChange={setDuration}
            onCountChange={setCount}
          />
        </>
      }
      onPromptChange={setPrompt}
      onModelChange={changeModel}
      onModelMenuOpenChange={(open) => {
        if (!open) return;
        setShowRatioMenu(false);
        setShowRefMenu(false);
      }}
      onSubmit={onGenerate}
      onEscape={edit.exitEdit}
    />
  );
}

/**
 * 渲染视频节点编辑态的卡片，并初始化外置编辑面板所需的共享状态。
 *
 * @param props - 当前视频节点标识与数据。
 */
function VideoNodeEditor({ data }: { data: VideoNodeData }) {
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
    },
    React.createElement(
      "div",
      { className: styles.imageNodeEditCardCol },
      React.createElement(VideoCardStatic, { d: data, editing: true }),
    ),
  );
}
