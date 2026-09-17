import type { Node } from "@xyflow/react";
import type { Asset } from "@weavl/shared";
import { getMediaCardSize, type IntrinsicMediaSize } from "@/app/canvas/utils/mediaSizing";

interface AssetNodeOptions {
  intrinsicSize?: IntrinsicMediaSize | null;
  mediaSource?: "upload" | "asset";
}

/**
 * 将资产转换为可放入画布的节点。
 * 资产在画布上使用稳定版本引用，节点只保留可编辑的展示快照。
 *
 * @param asset - 要放入画布的资产。
 * @param index - 用于计算初始错位位置的节点序号。
 * @param options - 上传来源以及已读取到的媒体原始尺寸。
 * @returns 匹配资产类型的 React Flow 节点。
 */
export function assetToCanvasNode(asset: Asset, index: number, options: AssetNodeOptions = {}): Node {
  const version = asset.versions.at(-1)!;
  const common = { title: asset.name, assetRef: { assetId: asset.id, versionId: version.id }, source: asset.source };
  const position = { x: 160 + (index % 3) * 340, y: 120 + Math.floor(index / 3) * 260 };
  const intrinsicSize = options.intrinsicSize ?? undefined;
  const size = intrinsicSize ? getMediaCardSize(intrinsicSize) : { w: 180, h: 180 };
  const mediaSource = options.mediaSource ?? "asset";
  if (asset.kind === "image")
    return {
      id: `asset_${asset.id}_${Date.now()}`,
      type: "uploadedImage",
      position,
      data: {
        ...common,
        nodeKind: "image",
        kind: "image",
        category: "资产",
        tint: "rgba(0,0,0,.08)",
        size,
        intrinsicSize,
        mediaSource,
        url: version.content,
      },
    };
  if (asset.kind === "video")
    return {
      id: `asset_${asset.id}_${Date.now()}`,
      type: "uploadedVideo",
      position,
      data: {
        ...common,
        nodeKind: "video",
        category: "资产",
        tint: "rgba(0,0,0,.08)",
        size,
        intrinsicSize,
        mediaSource,
        url: version.content,
      },
    };
  return {
    id: `asset_${asset.id}_${Date.now()}`,
    type: "text",
    position,
    data: {
      ...common,
      nodeKind: "text",
      text: version.content.startsWith("data:")
        ? `文件：${asset.name}\n类型：${asset.kind.toUpperCase()}\n来源：${asset.source}`
        : version.content,
    },
  };
}
