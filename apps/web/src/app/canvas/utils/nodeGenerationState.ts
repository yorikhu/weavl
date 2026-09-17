import type { Node } from "@xyflow/react";
import type { NodeGenerationStatus } from "../types/nodes";

export interface NodeGenerationStatePatch {
  generationStatus: NodeGenerationStatus;
  generationJobId?: string;
  generationError?: string;
}

/**
 * 将生成状态写入指定节点，供卡片 Loading、错误展示和画布自动保存共同消费。
 *
 * @param nodes - 当前画布节点。
 * @param nodeId - 正在生成内容的节点标识。
 * @param patch - 最新生成状态、任务标识和错误信息。
 * @returns 仅更新目标节点后的节点数组。
 */
export function updateNodeGenerationState(nodes: Node[], nodeId: string, patch: NodeGenerationStatePatch): Node[] {
  return nodes.map((node) =>
    node.id === nodeId
      ? {
          ...node,
          data: {
            ...(node.data as Record<string, unknown>),
            ...patch,
            generationError: patch.generationError,
          },
        }
      : node,
  );
}
