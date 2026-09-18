"use client";

import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { Handle, NodeToolbar, Position, useReactFlow, useStore, type Node, type NodeProps } from "@xyflow/react";
import type { GenerationModelOption } from "@weavl/shared";
import { Download, Image as ImageIcon, Maximize2, Palette } from "lucide-react";
import { Modal } from "@/components/Modal";
import { toast } from "@/hooks/useToast";
import { useGenerationQuote } from "@/hooks/useGenerationQuote";
import { formatGenerationPrice } from "@/lib/generationPricing";
import { API } from "@/lib/env";
import { jsonBody, studioApi } from "@/lib/studioApi";
import { useAccount } from "@/provider/AccountProvider";
import { MediaSettingsControl } from "../../../MediaSettingsControl";
import { NodePromptPanel } from "../../../NodePromptPanel";
import { NodeGenerationOverlay } from "../NodeGenerationOverlay";
import { EnterEditContext } from "../../../../editContext";
import { EditableNodeTitle } from "../../../EditableNodeTitle";
import type { ImageNodeData } from "../../../../types/nodes";
import {
  DEFAULT_IMAGE_DIMENSION,
  getGenerationDimension,
  getMediaCardSize,
  getResolutionTier,
  resolveMediaCapabilities,
  type MediaDimensionOption,
} from "../../../../utils/mediaSizing";
import { getGenerationErrorMessage, updateNodeGenerationState } from "../../../../utils/nodeGenerationState";
import { compilePromptDocument } from "../../../../utils/promptDocument";
import { downloadFile } from "@/utils/downloadFile";
import { CanvasActionToolbar } from "../../../CanvasActionToolbar";
import { waitForImageGeneration, type ImageGenerationJobView } from "../../../../utils/imageGenerationJobs";
import sharedStyles from "../../index.module.scss";

const styles = sharedStyles;
const IMAGE_TITLE_TOP_OFFSET = 8;
const IMAGE_TITLE_LINE_HEIGHT = 16;
const IMAGE_ACTIONS_TITLE_GAP = 10;
const FALLBACK_IMAGE_MODELS: GenerationModelOption[] = [
  {
    id: "gpt-image-2",
    kind: "image",
    label: "GPT Image 2",
    maker: "OpenAI",
    description: "支持灵活尺寸与高质量图片生成、编辑",
    configured: false,
  },
];

/** 将已完成的异步图片任务写回发起任务的节点。 */
function applyCompletedImageJob(nodes: Node[], nodeId: string, job: ImageGenerationJobView) {
  const generatedAsset = job.assets?.[0];
  const generatedVersion = generatedAsset?.versions.at(-1);
  if (!generatedAsset || !generatedVersion?.content) return nodes;
  const variants = (job.assets || []).flatMap((asset) => {
    const version = asset.versions.at(-1);
    return version?.content
      ? [{ url: version.content, assetRef: { assetId: asset.id, versionId: version.id } }]
      : [];
  });
  return nodes.map((node) =>
    node.id === nodeId
      ? {
          ...node,
          data: {
            ...node.data,
            url: generatedVersion.content,
            assetRef: { assetId: generatedAsset.id, versionId: generatedVersion.id },
            variants,
            generationStatus: "succeeded",
            generationError: undefined,
          },
        }
      : node,
  );
}

/**
 * 将历史图片质量值归一化为当前参数面板支持的三档文案。
 *
 * @param quality - 节点中保存的当前或历史质量值。
 * @returns 参数面板支持的标准质量文案。
 */
function normalizeImageQuality(quality?: string) {
  if (["低画质", "标准画质", "高画质", "超高画质", "极致画质", "自动"].includes(quality || "")) {
    return quality!;
  }
  return quality === "高清" ? "高画质" : "标准画质";
}

/** 将产品层画质文案转换为 GeekNow/OpenAI Images 协议枚举。 */
function toProviderImageQuality(quality: string) {
  return (
    {
      低画质: "low",
      标准画质: "medium",
      高画质: "high",
      超高画质: "xhigh",
      极致画质: "max",
      自动: "auto",
    } as Record<string, string>
  )[quality];
}

/**
 * 渲染图片节点在浏览态和编辑态共用的卡片主体。
 *
 * @param props - 图片数据、预览地址、文件选择回调与编辑状态。
 * @returns 图片节点的标题、预览和连接点。
 */
function ImageCardStatic({
  d,
  nodeId,
  onActivate,
  onIntrinsicSize,
}: {
  d: ImageNodeData;
  nodeId?: string;
  onActivate?: () => void;
  onIntrinsicSize?: (size: { width: number; height: number }) => void;
}) {
  const w = d.size?.w ?? 300;
  const h = d.size?.h ?? 200;
  const displayTitle = d.title || "图片节点";
  const url = d.url;
  const outputOnly = d.mediaSource === "upload" || d.mediaSource === "asset";

  return (
    <>
      <div className={styles.imageNodeTitleAbove}>
        <ImageIcon size={12} />
        {nodeId ? (
          <EditableNodeTitle nodeId={nodeId} value={d.title} fallback="图片节点" />
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
        {!outputOnly && <Handle type="target" position={Position.Left} className={styles.cardHandle} />}
        {/* 已有图则显示真图，否则占位渐变 */}
        {url ? (
          <div className={styles.imagePreview}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={d.title}
              className={styles.imageReal}
              onLoad={(event) =>
                onIntrinsicSize?.({
                  width: event.currentTarget.naturalWidth,
                  height: event.currentTarget.naturalHeight,
                })
              }
            />
          </div>
        ) : (
          <div className={`${styles.imagePreview} ${styles.emptyMediaPreview}`}>
            <div className={styles.imagePlaceholder}>
              <ImageIcon size={16} />
            </div>
          </div>
        )}
        <NodeGenerationOverlay status={d.generationStatus} label="图片" error={d.generationError} />
        <Handle type="source" position={Position.Right} className={styles.cardHandle} />
      </div>
    </>
  );
}

/**
 * 渲染 React Flow 图片节点，并根据编辑上下文切换展示状态。
 *
 * @param props - React Flow 注入的节点属性。
 * @returns 图片节点浏览态或编辑态组件。
 */
export function ImageNode({ data, id, selected }: NodeProps) {
  const edit = useContext(EnterEditContext);
  const { setNodes } = useReactFlow();
  const d = data as unknown as ImageNodeData;
  const [previewOpen, setPreviewOpen] = useState(false);
  const zoom = useStore((state) => state.transform[2]);
  const selectedNodeCount = useStore((state) =>
    state.nodes.reduce((count, node) => count + Number(Boolean(node.selected)), 0),
  );
  const groupMemberFocused = useStore((state) =>
    Boolean(state.nodeLookup.get(id)?.className?.split(/\s+/).includes("canvas-group-member-focused")),
  );
  useEffect(() => {
    const jobId = d.generationJobId;
    if (!jobId || !["queued", "running", "finalizing"].includes(d.generationStatus || "")) return;
    let active = true;
    void waitForImageGeneration(jobId)
      .then((job) => {
        if (!active) return;
        if (job.status === "failed") {
          setNodes((current) =>
            updateNodeGenerationState(current, id, {
              generationStatus: "failed",
              generationJobId: jobId,
              generationError: job.error || "图片生成失败",
            }),
          );
          return;
        }
        setNodes((current) => applyCompletedImageJob(current, id, job));
      })
      .catch((cause) => {
        if (!active) return;
        setNodes((current) =>
          updateNodeGenerationState(current, id, {
            generationStatus: "queued",
            generationJobId: jobId,
            generationError: getGenerationErrorMessage(cause, "图片任务查询失败"),
          }),
        );
      });
    return () => {
      active = false;
    };
  }, [d.generationJobId, d.generationStatus, id, setNodes]);
  useEffect(() => {
    if (d.url || d.ratio) return;
    setNodes((current) =>
      current.map((node) =>
        node.id === id
          ? {
              ...node,
              data: {
                ...node.data,
                ratio: DEFAULT_IMAGE_DIMENSION.ratio,
                generationSize: {
                  width: DEFAULT_IMAGE_DIMENSION.width,
                  height: DEFAULT_IMAGE_DIMENSION.height,
                },
                size: getMediaCardSize(DEFAULT_IMAGE_DIMENSION),
              },
            }
          : node,
      ),
    );
  }, [d.ratio, d.url, id, setNodes]);
  const updateIntrinsicSize = useCallback(
    (intrinsicSize: { width: number; height: number }) => {
      if (!d.url) return;
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
    [d.intrinsicSize?.height, d.intrinsicSize?.width, d.url, id, setNodes],
  );

  /** 节点操作栏只属于单选态；框选、多选时由画布级操作栏接管。 */
  const isSoleSelection = (selected && selectedNodeCount === 1) || (groupMemberFocused && selectedNodeCount === 0);
  const actions =
    d.url && isSoleSelection ? (
      <NodeToolbar
        nodeId={id}
        isVisible
        position={Position.Top}
        offset={(IMAGE_TITLE_TOP_OFFSET + IMAGE_TITLE_LINE_HEIGHT) * zoom + IMAGE_ACTIONS_TITLE_GAP}
        className={styles.imageNodeActions}
      >
        <CanvasActionToolbar
          ariaLabel="图片操作"
          variant="icons"
          actions={[
            {
              key: "download",
              icon: <Download />,
              title: "下载图片",
              onClick: () => {
                const downloadUrl = d.assetRef?.assetId
                  ? `${API}/studio/assets/${encodeURIComponent(d.assetRef.assetId)}/download`
                  : d.url!;
                void downloadFile(downloadUrl, d.title || "图片");
              },
            },
            {
              key: "preview",
              icon: <Maximize2 />,
              title: "全屏查看图片",
              onClick: () => setPreviewOpen(true),
            },
          ]}
        />
      </NodeToolbar>
    ) : null;

  const card =
    edit.editingId === id ? (
      <ImageNodeEditor nodeId={id} data={d} />
    ) : (
      <div className={styles.imageNodeWrap}>
        <ImageCardStatic
          d={d}
          nodeId={id}
          onActivate={d.mediaSource === "upload" || d.mediaSource === "asset" ? undefined : () => edit.enterEdit(id)}
          onIntrinsicSize={updateIntrinsicSize}
        />
      </div>
    );

  return (
    <>
      {actions}
      {card}
      {d.url && (
        <Modal
          open={previewOpen}
          title={d.title || "图片预览"}
          presentation="media"
          showClose
          onOpenChange={setPreviewOpen}
        >
          <div className={styles.imagePreviewDialogStage}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={d.url} alt={d.title || "图片预览"} />
          </div>
        </Modal>
      )}
    </>
  );
}

/**
 * 通过 Portal 在视口底部渲染当前图片节点的生成参数面板。
 *
 * @returns 当前节点不是图片时返回 `null`，否则返回图片编辑面板。
 */
export function ImageEditPanel() {
  const edit = useContext(EnterEditContext);
  const { refresh: refreshAccount } = useAccount();
  const { getNodes, setNodes } = useReactFlow();
  /** 当前编辑的图片节点（editingId）—— 字段初值取自节点的 data */
  const editingId = edit.editingId;
  const node = useStore((s) => (editingId ? (s.nodes.find((n) => n.id === editingId) ?? null) : null));
  const data = (node?.data as unknown as ImageNodeData | undefined) ?? null;
  /** 只渲染图片节点编辑栏（视频节点由 VideoEditPanel 渲染）。
     所有 hooks 必须在 early return 之前固定调用（Rules of Hooks） */
  const isImage = (data as unknown as { nodeKind?: string } | undefined)?.nodeKind === "image";

  const [prompt, setPrompt] = useState(data?.prompt ?? "");
  const [ratio, setRatio] = useState(data?.ratio ?? DEFAULT_IMAGE_DIMENSION.ratio);
  const [quality, setQuality] = useState(normalizeImageQuality(data?.quality));
  const [resolution, setResolution] = useState(data?.resolution ?? "2K");
  const [count, setCount] = useState(data?.count ?? 1);
  const [model, setModel] = useState(data?.model ?? "gpt-image-2");
  const [models, setModels] = useState<GenerationModelOption[]>(FALLBACK_IMAGE_MODELS);
  const [showRatioMenu, setShowRatioMenu] = useState(false);
  const syncedNodeIdRef = useRef<string | null>(null);
  const generatingNodeIdsRef = useRef(new Set<string>());
  const latestEditingIdRef = useRef(editingId);
  latestEditingIdRef.current = editingId;
  const busy = Boolean(
    editingId && ["queued", "running", "finalizing"].includes(data?.generationStatus || ""),
  );
  const selectedModel = models.find((item) => item.id === model);
  const capabilities = resolveMediaCapabilities("image", selectedModel?.capabilities);
  const dimensions = capabilities.dimensions;
  const selectedDimension = dimensions.find((item) => item.ratio === ratio) ?? dimensions[0];
  const effectiveRatio = selectedDimension?.ratio ?? ratio;
  const effectiveQuality = capabilities.qualities.length
    ? capabilities.qualities.includes(quality)
      ? quality
      : capabilities.qualities[0]!
    : "";
  const effectiveResolution = capabilities.resolutions.length
    ? capabilities.resolutions.includes(resolution)
      ? resolution
      : capabilities.resolutions[0]!
    : getResolutionTier(selectedDimension);
  const generationDimension = getGenerationDimension(capabilities, effectiveRatio, effectiveResolution);
  const effectiveCount = capabilities.counts.includes(count) ? count : (capabilities.counts[0] ?? count);
  const { quote: priceQuote, loading: priceLoading } = useGenerationQuote({
    modelId: model,
    parameters: {
      count: effectiveCount,
      ratio: effectiveRatio,
      resolution: effectiveResolution,
      ...(toProviderImageQuality(effectiveQuality) ? { quality: toProviderImageQuality(effectiveQuality) } : {}),
      size: generationDimension ? `${generationDimension.width}x${generationDimension.height}` : undefined,
    },
    enabled: isImage,
  });

  /** 提示词面板卸载不会保证 Popover 回调执行，编辑目标变化时主动清理打开态。 */
  useEffect(() => {
    setShowRatioMenu(false);
  }, [editingId]);
  useEffect(() => {
    if (!isImage) return;
    void studioApi<GenerationModelOption[]>("/studio/generations/models?kind=image")
      .then((options) => {
        setModels(options);
        setModel((current) => (options.some((option) => option.id === current) ? current : options[0]?.id || current));
      })
      .catch(() => setModels(FALLBACK_IMAGE_MODELS));
  }, [editingId, isImage]);

  /** 节点变更（切到不同图片节点编辑）时同步字段初值 */
  useEffect(() => {
    if (!editingId) {
      syncedNodeIdRef.current = null;
      return;
    }
    if (!data) return;
    if (syncedNodeIdRef.current === editingId) return;
    setPrompt(data.prompt ?? "");
    setRatio(data.ratio ?? DEFAULT_IMAGE_DIMENSION.ratio);
    setQuality(normalizeImageQuality(data.quality));
    setResolution(data.resolution ?? "2K");
    setCount(data.count ?? 1);
    setModel(data.model ?? "gpt-image-2");
    syncedNodeIdRef.current = editingId;
  }, [editingId, data]);

  /**
   * 同步图片生成尺寸与画布卡片比例，卡片展示尺寸由统一缩放规则计算。
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
          const currentData = currentNode.data as unknown as ImageNodeData;
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
   * 切换模型，并在原比例不受新模型支持时选择该模型的首个规格。
   *
   * @param nextModel - 新的稳定模型标识。
   * @returns 无返回值。
   */
  const changeModel = useCallback(
    (nextModel: string) => {
      setModel(nextModel);
      const nextCapabilities = resolveMediaCapabilities(
        "image",
        models.find((item) => item.id === nextModel)?.capabilities,
      );
      const nextDimensions = nextCapabilities.dimensions;
      if (!nextDimensions.some((item) => item.ratio === ratio) && nextDimensions[0]) {
        changeDimension(nextDimensions[0]);
      }
      if (!nextCapabilities.qualities.includes(quality) && nextCapabilities.qualities[0]) {
        setQuality(nextCapabilities.qualities[0]);
      }
      if (nextCapabilities.resolutions.length && !nextCapabilities.resolutions.includes(resolution)) {
        setResolution(nextCapabilities.resolutions[0]!);
      }
      if (!nextCapabilities.counts.includes(count) && nextCapabilities.counts[0]) {
        setCount(nextCapabilities.counts[0]);
      }
    },
    [changeDimension, count, models, quality, ratio, resolution],
  );

  /** 实时同步到 imageEditStateRef，供外部 commitEdit / commitImageEdit 取最新值 */
  useEffect(() => {
    edit.imageEditStateRef.current = {
      prompt,
      ratio: effectiveRatio,
      quality: effectiveQuality,
      resolution: effectiveResolution,
      count: effectiveCount,
      model,
      generationSize: generationDimension
        ? { width: generationDimension.width, height: generationDimension.height }
        : undefined,
    };
  }, [
    prompt,
    effectiveRatio,
    effectiveQuality,
    effectiveResolution,
    effectiveCount,
    model,
    generationDimension,
    edit,
  ]);

  /**
   * 生成图片并把全部产物版本归入当前节点，画布只更新原节点。
   *
   * @returns 图片生成和节点写回完成后的 Promise。
   */
  const onGenerate = useCallback(async () => {
    const nodeId = edit.editingId;
    if (!nodeId || !prompt.trim() || generatingNodeIdsRef.current.has(nodeId)) return;
    let submittedJobId: string | null = null;
    generatingNodeIdsRef.current.add(nodeId);
    setNodes((nodes) =>
      updateNodeGenerationState(nodes, nodeId, { generationStatus: "running", generationError: undefined }),
    );
    try {
      const currentNodes = getNodes();
      const currentData = currentNodes.find((item) => item.id === nodeId)?.data as ImageNodeData | undefined;
      const compiledPrompt = compilePromptDocument(prompt, currentData?.promptParts, currentData?.inputMaterialNodeIds);
      const referenceAssetIds = compiledPrompt.materialNodeIds.flatMap((materialNodeId) => {
        const materialData = currentNodes.find((item) => item.id === materialNodeId)?.data as ImageNodeData | undefined;
        return materialData?.nodeKind === "image" && materialData.assetRef?.assetId
          ? [materialData.assetRef.assetId]
          : [];
      });
      const submittedJob = await studioApi<ImageGenerationJobView>("/studio/generations/image", {
        method: "POST",
        body: jsonBody({
          model,
          prompt: compiledPrompt.prompt,
          ratio: effectiveRatio,
          ...(toProviderImageQuality(effectiveQuality) ? { quality: toProviderImageQuality(effectiveQuality) } : {}),
          count: effectiveCount,
          size: generationDimension ? `${generationDimension.width}x${generationDimension.height}` : undefined,
          resolution: effectiveResolution,
          referenceAssetIds,
        }),
      });
      submittedJobId = submittedJob.id;
      void refreshAccount();
      setNodes((currentNodes) =>
        currentNodes.map((currentNode) =>
          currentNode.id === nodeId
            ? {
                ...currentNode,
                data: {
                  ...currentNode.data,
                  prompt,
                  ratio: effectiveRatio,
                  quality: effectiveQuality,
                  resolution: effectiveResolution,
                  count: effectiveCount,
                  model,
                  size: generationDimension ? getMediaCardSize(generationDimension) : currentData?.size,
                  generationSize: generationDimension
                    ? { width: generationDimension.width, height: generationDimension.height }
                    : currentData?.generationSize,
                  generationStatus: "queued",
                  generationJobId: submittedJob.id,
                  generationError: undefined,
                },
              }
            : currentNode,
        ),
      );
      const completedJob = await waitForImageGeneration(submittedJob.id);
      if (completedJob.status === "failed" || !completedJob.assets?.[0]?.versions.at(-1)?.content) {
        const message = completedJob.error || "图片模型没有返回可用产物";
        setNodes((nodes) =>
          updateNodeGenerationState(nodes, nodeId, {
            generationStatus: "failed",
            generationJobId: submittedJob.id,
            generationError: message,
          }),
        );
        void refreshAccount();
        toast(message);
        return;
      }
      setNodes((currentNodes) => applyCompletedImageJob(currentNodes, nodeId, completedJob));
      if (latestEditingIdRef.current === nodeId) edit.exitEdit();
      toast(completedJob.assets.length > 1 ? `${completedJob.assets.length} 张图片已生成` : "图片已生成", "success");
    } catch (cause) {
      const message = getGenerationErrorMessage(cause, "图片生成失败");
      void refreshAccount();
      setNodes((nodes) =>
        updateNodeGenerationState(nodes, nodeId, {
          generationStatus: submittedJobId ? "queued" : "failed",
          generationJobId: submittedJobId || undefined,
          generationError: message,
        }),
      );
      toast(submittedJobId ? "任务已提交，状态查询暂时中断，重新打开画布后会继续恢复" : message);
    } finally {
      generatingNodeIdsRef.current.delete(nodeId);
    }
  }, [
    edit,
    effectiveCount,
    effectiveQuality,
    effectiveRatio,
    effectiveResolution,
    getNodes,
    model,
    prompt,
    generationDimension,
    refreshAccount,
    setNodes,
  ]);

  if (!edit.editingId || !isImage) return null;

  return (
    <NodePromptPanel
      nodeId={edit.editingId}
      prompt={prompt}
      placeholder="描述想生成的图片，或输入对当前图片的修改要求…"
      model={model}
      models={models.map((item) => ({
        id: item.id,
        label: item.label,
        detail: item.configured ? item.maker : `${item.maker} · 未配置`,
      }))}
      modelMenuLabel="图片模型"
      cost={formatGenerationPrice(priceQuote)}
      costLoading={priceLoading}
      busy={busy}
      header={
        <div className={styles.imageEditBarHead}>
          <div className={styles.imageEditBarTags}>
            <button className={styles.imageEditTag}>
              <Palette size={11} />
              风格
            </button>
          </div>
          {/* TODO(canvas-media): 实现图片沉浸式编辑器后启用放大编辑入口。 */}
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
            ratio={effectiveRatio}
            dimensions={dimensions}
            quality={effectiveQuality}
            qualities={capabilities.qualities}
            resolution={capabilities.resolutions.length ? effectiveResolution : undefined}
            resolutions={capabilities.resolutions.length ? capabilities.resolutions : undefined}
            count={effectiveCount}
            counts={capabilities.counts}
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
      onSubmit={() => void onGenerate()}
      onEscape={edit.exitEdit}
    />
  );
}

/**
 * 渲染图片节点编辑态的卡片，并初始化外置编辑面板所需的共享状态。
 *
 * @param props - 当前图片节点标识与数据。
 * @returns 图片节点编辑态组件。
 */
function ImageNodeEditor({ nodeId, data }: { nodeId: string; data: ImageNodeData }) {
  const edit = useContext(EnterEditContext);
  /** 编辑栏已外置，节点的 imageEditStateRef 由外层 ImageEditPanel 维护。
     这里只需要为节点"占位"留个空 ref（避免 commitEdit 走 image 分支时拿到 null） */
  useEffect(() => {
    if (edit.imageEditStateRef.current == null) {
      edit.imageEditStateRef.current = {
        prompt: data.prompt ?? "",
        ratio: data.ratio ?? DEFAULT_IMAGE_DIMENSION.ratio,
        quality: normalizeImageQuality(data.quality),
        resolution: data.resolution ?? "2K",
        count: data.count ?? 1,
        model: data.model ?? "gpt-image-2",
        url: data.url,
      };
    }
  }, [edit, data]);

  return (
    <div className={styles.imageNodeEditWrap}>
      <div className={styles.imageNodeEditCardCol}>
        <ImageCardStatic d={data} nodeId={nodeId} />
      </div>
    </div>
  );
}
