"use client";

import React, { useCallback, useContext, useEffect, useRef, useState } from "react";
import { Handle, Position, useReactFlow, useStore, type NodeProps } from "@xyflow/react";
import type { Asset, GenerationModelOption } from "@weavl/shared";
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
import { toast } from "@/hooks/useToast";
import { useGenerationQuote } from "@/hooks/useGenerationQuote";
import { formatGenerationPrice } from "@/lib/generationPricing";
import { jsonBody, studioApi } from "@/lib/studioApi";
import { MediaSettingsControl } from "../../../MediaSettingsControl";
import { NodePromptPanel } from "../../../NodePromptPanel";
import { NodeGenerationOverlay } from "../NodeGenerationOverlay";
import { EnterEditContext } from "../../../../editContext";
import { EditableNodeTitle } from "../../../EditableNodeTitle";
import type { VideoNodeData } from "../../../../types/nodes";
import { getMediaCardSize, resolveMediaCapabilities, type MediaDimensionOption } from "../../../../utils/mediaSizing";
import { updateNodeGenerationState } from "../../../../utils/nodeGenerationState";
import sharedStyles from "../../index.module.scss";

const styles = sharedStyles;
const FALLBACK_VIDEO_MODELS: GenerationModelOption[] = [
  {
    id: "doubao-seedance-2.0",
    kind: "video",
    label: "Doubao-Seedance-2.0",
    maker: "ByteDance",
    description: "支持文生视频、图生视频和参考音频的视频模型",
    configured: false,
  },
];

/** 视频生成接口返回的可轮询任务视图。 */
interface VideoGenerationJob {
  id: string;
  status: "queued" | "running" | "finalizing" | "succeeded" | "failed";
  error?: string | null;
  assets?: Asset[];
}

/**
 * 渲染视频节点在浏览态和编辑态共用的卡片主体。
 *
 * @param props - 视频数据、预览地址、文件选择回调与编辑状态。
 * @returns 视频节点的标题、预览和连接点。
 */
function VideoCardStatic({
  d,
  nodeId,
  onActivate,
  editing = false,
  onIntrinsicSize,
}: {
  d: VideoNodeData;
  nodeId?: string;
  onActivate?: () => void;
  editing?: boolean;
  onIntrinsicSize?: (size: { width: number; height: number }) => void;
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
        ) : nodeId ? (
          <EditableNodeTitle nodeId={nodeId} value={d.title} fallback="视频节点" />
        ) : (
          <span>{displayTitle}</span>
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
            <video
              src={url}
              className={styles.imageReal}
              muted
              preload="metadata"
              onLoadedMetadata={(event) =>
                onIntrinsicSize?.({
                  width: event.currentTarget.videoWidth,
                  height: event.currentTarget.videoHeight,
                })
              }
            />
          </div>
        ) : (
          <div className={`${styles.imagePreview} ${styles.emptyMediaPreview}`}>
            <div className={styles.imagePlaceholder}>
              <VideoIcon size={16} />
            </div>
          </div>
        )}
        <NodeGenerationOverlay status={d.generationStatus} label="视频" />
        <Handle type="source" position={Position.Right} className={styles.cardHandle} />
      </div>
    </>
  );
}

/**
 * 渲染 React Flow 视频节点，并根据编辑上下文切换展示状态。
 *
 * @param props - React Flow 注入的节点属性。
 * @returns 视频节点浏览态或编辑态组件。
 */
export function VideoNode({ data, id }: NodeProps) {
  const edit = useContext(EnterEditContext);
  const { setNodes } = useReactFlow();
  const d = data as unknown as VideoNodeData;
  const updateIntrinsicSize = useCallback(
    (intrinsicSize: { width: number; height: number }) => {
      if (d.mediaSource !== "upload" && d.mediaSource !== "asset") return;
      if (intrinsicSize.width <= 0 || intrinsicSize.height <= 0) return;
      if (d.intrinsicSize?.width === intrinsicSize.width && d.intrinsicSize.height === intrinsicSize.height) return;
      setNodes((current) =>
        current.map((node) =>
          node.id === id
            ? {
                ...node,
                data: { ...node.data, intrinsicSize, size: getMediaCardSize(intrinsicSize) },
              }
            : node,
        ),
      );
    },
    [d.intrinsicSize?.height, d.intrinsicSize?.width, d.mediaSource, id, setNodes],
  );

  if (edit.editingId === id) {
    return <VideoNodeEditor data={d} />;
  }

  return (
    <div className={styles.imageNodeWrap}>
      <VideoCardStatic
        d={d}
        nodeId={id}
        onActivate={d.mediaSource === "upload" || d.mediaSource === "asset" ? undefined : () => edit.enterEdit(id)}
        onIntrinsicSize={updateIntrinsicSize}
      />
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
  const [model, setModel] = useState(data?.model ?? "doubao-seedance-2.0");
  const [models, setModels] = useState<GenerationModelOption[]>(FALLBACK_VIDEO_MODELS);
  const [busy, setBusy] = useState(false);
  const [refType, setRefType] = useState("全能参考");
  const [showRatioMenu, setShowRatioMenu] = useState(false);
  const [showRefMenu, setShowRefMenu] = useState(false);
  const syncedNodeIdRef = useRef<string | null>(null);
  const selectedModel = models.find((item) => item.id === model);
  const capabilities = resolveMediaCapabilities("video", selectedModel?.capabilities);
  const dimensions = capabilities.dimensions;
  const selectedDimension = dimensions.find((item) => item.ratio === ratio) ?? dimensions[0];
  const { quote: priceQuote, loading: priceLoading } = useGenerationQuote({
    modelId: model,
    parameters: { count, ratio, resolution: quality.toLowerCase(), durationSeconds: duration, generateAudio: false },
    enabled: isVideo,
  });
  /** 编辑目标变化时清理所有附属菜单，避免新提示词面板继承旧节点状态。 */
  useEffect(() => {
    setShowRatioMenu(false);
    setShowRefMenu(false);
  }, [editingId]);
  useEffect(() => {
    if (!isVideo) return;
    void studioApi<GenerationModelOption[]>("/studio/generations/models?kind=video")
      .then((options) => {
        setModels(options);
        setModel((current) => (options.some((option) => option.id === current) ? current : options[0]?.id || current));
      })
      .catch(() => setModels(FALLBACK_VIDEO_MODELS));
  }, [isVideo]);
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
    setModel(data.model ?? "doubao-seedance-2.0");
    syncedNodeIdRef.current = editingId;
  }, [editingId, data]);
  /**
   * 同步视频输出规格与画布卡片比例。
   *
   * @param nextDimension - 用户选择的模型输出规格。
   * @returns 无返回值。
   */
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
              size: currentData.url ? currentData.size : nextSize,
            },
          };
        }),
      );
    },
    [editingId, setNodes],
  );
  /**
   * 切换模型，并在必要时回退到新模型支持的首个画面比例。
   *
   * @param nextModel - 新的稳定模型标识。
   * @returns 无返回值。
   */
  const changeModel = useCallback(
    (nextModel: string) => {
      setModel(nextModel);
      const nextCapabilities = resolveMediaCapabilities(
        "video",
        models.find((item) => item.id === nextModel)?.capabilities,
      );
      const nextDimensions = nextCapabilities.dimensions;
      if (!nextDimensions.some((item) => item.ratio === ratio) && nextDimensions[0]) {
        changeDimension(nextDimensions[0]);
      }
      if (!nextCapabilities.resolutions.includes(quality) && nextCapabilities.resolutions[0]) {
        setQuality(nextCapabilities.resolutions[0]);
      }
      if (!nextCapabilities.durations.includes(duration) && nextCapabilities.durations[0]) {
        setDuration(nextCapabilities.durations[0]);
      }
      if (!nextCapabilities.counts.includes(count) && nextCapabilities.counts[0]) {
        setCount(nextCapabilities.counts[0]);
      }
    },
    [changeDimension, count, duration, models, quality, ratio],
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
  /**
   * 提交视频长任务并按官方建议的间隔轮询，全部产物版本归入原节点。
   *
   * @returns 视频任务结束并完成节点写回后的 Promise。
   */
  const onGenerate = useCallback(async () => {
    const nodeId = edit.editingId;
    if (!nodeId || !prompt.trim() || busy) return;
    setBusy(true);
    setNodes((nodes) =>
      updateNodeGenerationState(nodes, nodeId, { generationStatus: "queued", generationError: undefined }),
    );
    try {
      let job = await studioApi<VideoGenerationJob>("/studio/generations/video", {
        method: "POST",
        body: jsonBody({
          model,
          prompt,
          count,
          ratio,
          resolution: quality.toLowerCase(),
          durationSeconds: duration,
        }),
      });
      setNodes((nodes) =>
        updateNodeGenerationState(nodes, nodeId, {
          generationStatus: job.status,
          generationJobId: job.id,
          generationError: undefined,
        }),
      );
      for (let attempt = 0; attempt < 40 && job.status !== "succeeded" && job.status !== "failed"; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 15000));
        job = await studioApi<VideoGenerationJob>(`/studio/generations/video/${job.id}`);
        setNodes((nodes) =>
          updateNodeGenerationState(nodes, nodeId, {
            generationStatus: job.status,
            generationJobId: job.id,
            generationError: job.error || undefined,
          }),
        );
      }
      if (job.status === "failed") throw new Error(job.error || "视频生成失败");
      if (job.status !== "succeeded") throw new Error("视频仍在生成，请稍后重试");
      const generatedAssets = job.assets || [];
      const generatedAsset = generatedAssets[0];
      const generatedVersion = generatedAsset?.versions.at(-1);
      if (!generatedAsset || !generatedVersion?.content) throw new Error("视频模型没有返回可用产物");
      const variants = generatedAssets.flatMap((asset) => {
        const version = asset.versions.at(-1);
        return version?.content
          ? [{ url: version.content, assetRef: { assetId: asset.id, versionId: version.id } }]
          : [];
      });
      edit.commitVideoEdit?.(nodeId, {
        prompt,
        ratio,
        quality,
        duration,
        count,
        model,
        url: generatedVersion.content,
        assetRef: { assetId: generatedAsset.id, versionId: generatedVersion.id },
        variants,
        size: selectedDimension ? getMediaCardSize(selectedDimension) : undefined,
        generationSize: selectedDimension
          ? { width: selectedDimension.width, height: selectedDimension.height }
          : undefined,
      });
      setNodes((nodes) =>
        updateNodeGenerationState(nodes, nodeId, {
          generationStatus: "succeeded",
          generationJobId: job.id,
        }),
      );
      toast(generatedAssets.length > 1 ? `${generatedAssets.length} 个视频已生成` : "视频已生成", "success");
    } catch (cause) {
      const message = (cause as Error).message || "视频生成失败";
      setNodes((nodes) =>
        updateNodeGenerationState(nodes, nodeId, { generationStatus: "failed", generationError: message }),
      );
      toast(message);
    } finally {
      setBusy(false);
    }
  }, [busy, count, duration, edit, model, prompt, quality, ratio, selectedDimension, setNodes]);
  const refOptions = ["全能参考", "人脸参考", "首尾帧", "角色一致性"];
  if (!edit.editingId || !isVideo) return null;

  return (
    <NodePromptPanel
      nodeId={edit.editingId}
      prompt={prompt}
      placeholder="描述想生成的视频画面、动作与节奏，或引用已有素材…"
      model={model}
      models={models.map((item) => ({
        id: item.id,
        label: item.label,
        detail: item.configured ? item.maker : `${item.maker} · 未配置`,
      }))}
      modelMenuLabel="视频模型"
      cost={formatGenerationPrice(priceQuote)}
      costLoading={priceLoading}
      busy={busy}
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
          {/* TODO(canvas-media): 实现视频沉浸式编辑器后启用放大编辑入口。 */}
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
            qualities={capabilities.resolutions}
            qualityLabel="清晰度"
            duration={duration}
            durations={capabilities.durations}
            count={count}
            counts={capabilities.counts}
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
      onSubmit={() => void onGenerate()}
      onEscape={edit.exitEdit}
    />
  );
}

/**
 * 渲染视频节点编辑态的卡片，并初始化外置编辑面板所需的共享状态。
 *
 * @param props - 当前视频节点标识与数据。
 * @returns 视频节点编辑态组件。
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
        model: data.model ?? "doubao-seedance-2.0",
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
