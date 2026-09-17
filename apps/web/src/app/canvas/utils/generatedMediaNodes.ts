import type { Asset } from "@weavl/shared";
import type { Node } from "@xyflow/react";

/**
 * 将同一次生成的额外媒体产物放到源节点右下方。
 * 第一个产物由编辑上下文写回原节点，本函数只处理剩余产物。
 * 新节点继承源节点类型和分组信息，同时获得独立资产引用与更高层级。
 *
 * @param nodes - 当前画布节点快照。
 * @param sourceId - 发起本次生成的源节点 ID。
 * @param assets - 尚未写入源节点的额外生成资产。
 * @returns 包含新增媒体节点的新数组；无法定位源节点时原样返回。
 */
export function appendGeneratedMediaNodes(nodes: Node[], sourceId: string, assets: Asset[]): Node[] {
  if (!assets.length) return nodes;
  const source = nodes.find((node) => node.id === sourceId);
  if (!source) return nodes;
  const firstLayer = Math.max(0, ...nodes.map((node) => node.zIndex ?? 0)) + 1;
  const additions = assets.flatMap((asset, index) => {
    const version = asset.versions.at(-1);
    if (!version?.content) return [];
    return [
      {
        ...source,
        id: `node_${crypto.randomUUID()}`,
        position: { x: source.position.x + (index + 1) * 28, y: source.position.y + (index + 1) * 28 },
        selected: false,
        dragging: false,
        zIndex: firstLayer + index,
        data: {
          ...(source.data as Record<string, unknown>),
          title: asset.name,
          url: version.content,
          assetRef: { assetId: asset.id, versionId: version.id },
        },
      } satisfies Node,
    ];
  });
  return [...nodes, ...additions];
}
