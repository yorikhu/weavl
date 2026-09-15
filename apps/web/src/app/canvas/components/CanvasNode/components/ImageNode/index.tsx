"use client";

import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { Handle, Position, useReactFlow, useStore, type NodeProps } from "@xyflow/react";
import {
  Image as ImageIcon,
  ImagePlus,
  Maximize2,
  Palette,
  RefreshCw,
  Tag,
} from "lucide-react";
import { MediaSettingsControl } from "../../../MediaSettingsControl";
import { NodePromptPanel } from "../../../NodePromptPanel";
import { EnterEditContext } from "../../../../editContext";
import { EditableNodeTitle } from "../../../EditableNodeTitle";
import type { ImageNodeData } from "../../../../types/nodes";
import {
  getMediaCardSize,
  getMediaDimensions,
  type MediaDimensionOption,
} from "../../../../utils/mediaSizing";
import sharedStyles from "../../index.module.scss";

const styles = sharedStyles;

function normalizeImageQuality(quality?: string) {
  if (quality === "低画质" || quality === "标准画质" || quality === "高画质") return quality;
  return quality === "高清" ? "高画质" : "标准画质";
}

/**
 * 渲染图片节点在浏览态和编辑态共用的卡片主体。
 *
 * @param props - 图片数据、预览地址、文件选择回调与编辑状态。
 */
function ImageCardStatic({
  d,
  nodeId,
  onActivate,
  editing = false,
}: {
  d: ImageNodeData;
  nodeId?: string;
  onActivate?: () => void;
  editing?: boolean;
}) {
  const edit = useContext(EnterEditContext);
  const w = d.size?.w ?? 300;
  const h = d.size?.h ?? 200;
  const displayTitle = d.title || "图片节点";
  const url = d.url;

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
          nodeId ? <EditableNodeTitle nodeId={nodeId} value={d.title} fallback="图片节点" /> : <span>{displayTitle}</span>
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
        {/* 已有图则显示真图，否则占位渐变 */}
        {url ? (
          <div className={styles.imagePreview}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={d.title} className={styles.imageReal} />
          </div>
        ) : (
          <div className={`${styles.imagePreview} ${styles.emptyMediaPreview}`}>
            <div className={styles.imagePlaceholder}>
              <ImageIcon size={16} />
            </div>
          </div>
        )}
        <Handle type="source" position={Position.Right} className={styles.cardHandle} />
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
    return <ImageNodeEditor data={d} />;
  }

  return (
    <div className={styles.imageNodeWrap}>
      <ImageCardStatic d={d} nodeId={id} onActivate={() => edit.enterEdit(id)} />
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
  const { setNodes } = useReactFlow();
  /** 当前编辑的图片节点（editingId）—— 字段初值取自节点的 data */
  const editingId = edit.editingId;
  const node = useStore((s) => (editingId ? (s.nodes.find((n) => n.id === editingId) ?? null) : null));
  const data = (node?.data as unknown as ImageNodeData | undefined) ?? null;
  /** 只渲染图片节点编辑栏（视频节点由 VideoEditPanel 渲染）。
     所有 hooks 必须在 early return 之前固定调用（Rules of Hooks） */
  const isImage = (data as unknown as { nodeKind?: string } | undefined)?.nodeKind === "image";

  const [prompt, setPrompt] = useState(data?.prompt ?? "");
  const [ratio, setRatio] = useState(data?.ratio ?? "1:1");
  const [quality, setQuality] = useState(normalizeImageQuality(data?.quality));
  const [resolution, setResolution] = useState(data?.resolution ?? "2K");
  const [count, setCount] = useState(data?.count ?? 1);
  const [model, setModel] = useState(data?.model ?? "Weavl Image");
  const [showRatioMenu, setShowRatioMenu] = useState(false);
  const syncedNodeIdRef = useRef<string | null>(null);
  const dimensions = getMediaDimensions("image", model);
  const selectedDimension = dimensions.find((item) => item.ratio === ratio) ?? dimensions[0];

  /** 节点变更（切到不同图片节点编辑）时同步字段初值 */
  useEffect(() => {
    if (!editingId) {
      syncedNodeIdRef.current = null;
      return;
    }
    if (!data) return;
    if (syncedNodeIdRef.current === editingId) return;
    setPrompt(data.prompt ?? "");
    setRatio(data.ratio ?? "1:1");
    setQuality(normalizeImageQuality(data.quality));
    setResolution(data.resolution ?? "2K");
    setCount(data.count ?? 1);
    setModel(data.model ?? "Weavl Image");
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
          const currentData = currentNode.data as unknown as ImageNodeData;
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
      const nextDimensions = getMediaDimensions("image", nextModel);
      if (!nextDimensions.some((item) => item.ratio === ratio) && nextDimensions[0]) {
        changeDimension(nextDimensions[0]);
      }
    },
    [changeDimension, ratio],
  );

  /** 实时同步到 imageEditStateRef，供外部 commitEdit / commitImageEdit 取最新值 */
  useEffect(() => {
    edit.imageEditStateRef.current = {
      prompt,
      ratio,
      quality,
      resolution,
      count,
      model,
      generationSize: selectedDimension
        ? { width: selectedDimension.width, height: selectedDimension.height }
        : undefined,
      title: edit.buffer.title,
    };
  }, [prompt, ratio, quality, resolution, count, model, selectedDimension, edit]);

  /** 发送：写入节点 data，保留编辑栏在屏上的同时更新预览（提示用户"已生成"）—— 简化：直接退出编辑态 */
  const onGenerate = useCallback(() => {
    if (!edit.editingId) return;
    edit.commitImageEdit?.(edit.editingId, {
      prompt,
      ratio,
      quality,
      resolution,
      count,
      model,
      generationSize: selectedDimension
        ? { width: selectedDimension.width, height: selectedDimension.height }
        : undefined,
      title: undefined,
    });
  }, [edit, prompt, ratio, quality, resolution, count, model, selectedDimension]);

  const modelOptions = ["Weavl Image", "Lib Image", "SDXL", "DALL·E 3"];

  if (!edit.editingId || !isImage) return null;

  return (
    <NodePromptPanel
      nodeId={edit.editingId}
      prompt={prompt}
      placeholder="描述想生成的图片，或输入对当前图片的修改要求…"
      model={model}
      models={modelOptions.map((item) => ({ id: item, label: item }))}
      modelMenuLabel="图片模型"
      cost={count * (resolution === "4K" ? 24 : resolution === "2K" ? 12 : 6)}
      rows={3}
      header={
        <div className={styles.imageEditBarHead}>
          <div className={styles.imageEditBarTags}>
            <button className={styles.imageEditTag} title="上传参考图">
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
      }
      footerMiddle={
        <>
          <span className={styles.imageEditParamSep} />
          <MediaSettingsControl
            open={showRatioMenu}
            ratio={ratio}
            dimensions={dimensions}
            quality={quality}
            qualities={["低画质", "标准画质", "高画质"]}
            resolution={resolution}
            resolutions={["1K", "2K", "4K"]}
            count={count}
            counts={[1, 2, 4]}
            countUnit="张"
            onOpenChange={setShowRatioMenu}
            onDimensionChange={changeDimension}
            onQualityChange={setQuality}
            onResolutionChange={setResolution}
            onCountChange={setCount}
          />
        </>
      }
      onPromptChange={setPrompt}
      onModelChange={changeModel}
      onModelMenuOpenChange={(open) => open && setShowRatioMenu(false)}
      onSubmit={onGenerate}
      onEscape={edit.exitEdit}
    />
  );
}

/**
 * 渲染图片节点编辑态的卡片，并初始化外置编辑面板所需的共享状态。
 *
 * @param props - 当前图片节点标识与数据。
 */
function ImageNodeEditor({ data }: { data: ImageNodeData }) {
  const edit = useContext(EnterEditContext);
  /** 编辑栏已外置，节点的 imageEditStateRef 由外层 ImageEditPanel 维护。
     这里只需要为节点"占位"留个空 ref（避免 commitEdit 走 image 分支时拿到 null） */
  useEffect(() => {
    if (edit.imageEditStateRef.current == null) {
      edit.imageEditStateRef.current = {
        prompt: data.prompt ?? "",
        ratio: data.ratio ?? "1:1",
        quality: normalizeImageQuality(data.quality),
        resolution: data.resolution ?? "2K",
        count: data.count ?? 1,
        model: data.model ?? "Weavl Image",
        url: data.url,
        title: edit.buffer.title,
      };
    }
  }, [edit, data]);

  return (
    <div className={styles.imageNodeEditWrap}>
      <div className={styles.imageNodeEditCardCol}>
        <ImageCardStatic d={data} editing />
      </div>
    </div>
  );
}
