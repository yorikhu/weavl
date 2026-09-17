import type { Edge, Node } from "@xyflow/react";

/** 提示词面板可引用的直接上游媒体节点。 */
export interface PromptMaterial {
  nodeId: string;
  kind: "image" | "video";
  name: string;
  url?: string;
}

/**
 * 收集直接连入目标节点的图片和视频，顺序与连线顺序一致且自动去重。
 *
 * @param nodes - 当前画布节点。
 * @param edges - 当前画布连线。
 * @param targetId - 接收素材的目标节点。
 * @returns 可在提示词中引用的上游媒体列表。
 */
export function getPromptMaterials(nodes: Node[], edges: Edge[], targetId: string): PromptMaterial[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const seen = new Set<string>();
  return edges.flatMap((edge) => {
    if (edge.target !== targetId || seen.has(edge.source)) return [];
    const source = byId.get(edge.source);
    const data = source?.data as Record<string, unknown> | undefined;
    if (!source || (data?.nodeKind !== "image" && data?.nodeKind !== "video")) return [];
    seen.add(source.id);
    return [
      {
        nodeId: source.id,
        kind: data.nodeKind,
        name: typeof data.title === "string" && data.title.trim() ? data.title : data.nodeKind === "image" ? "图片" : "视频",
        url: typeof data.url === "string" ? data.url : undefined,
      },
    ];
  });
}
