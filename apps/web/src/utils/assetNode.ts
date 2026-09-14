import type { Node } from "@xyflow/react";
import type { Asset } from "@weavl/shared";

/** 资产在画布上是稳定版本引用，节点只保留可编辑的展示快照。 */
export function assetToCanvasNode(asset: Asset, index: number): Node {
  const version = asset.versions.at(-1)!;
  const common = { title: asset.name, assetRef: { assetId: asset.id, versionId: version.id }, source: asset.source };
  const position = { x: 160 + (index % 3) * 340, y: 120 + Math.floor(index / 3) * 260 };
  if (asset.kind === "image")
    return {
      id: `asset_${asset.id}_${Date.now()}`,
      type: "image",
      position,
      data: {
        ...common,
        nodeKind: "image",
        kind: "image",
        category: "资产",
        tint: "rgba(0,0,0,.08)",
        size: { w: 300, h: 200 },
        url: version.content,
      },
    };
  if (asset.kind === "video")
    return {
      id: `asset_${asset.id}_${Date.now()}`,
      type: "video",
      position,
      data: {
        ...common,
        nodeKind: "video",
        category: "资产",
        tint: "rgba(0,0,0,.08)",
        size: { w: 300, h: 200 },
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
