import type { Node } from "@xyflow/react";
import type { NodeGenerationStatus } from "../types/nodes";

export interface NodeGenerationStatePatch {
  generationStatus: NodeGenerationStatus;
  generationJobId?: string;
  generationError?: string;
}

/**
 * 将供应商错误转换成适合直接展示给创作者的简短提示。
 * 原始错误仍由服务端日志和渠道调用记录保存，画布无需暴露供应商协议细节。
 *
 * @param cause - 请求抛出的未知错误。
 * @param fallback - 无法取得有效错误信息时使用的默认文案。
 * @returns 可在节点和轻提示中展示的错误信息。
 */
export function getGenerationErrorMessage(cause: unknown, fallback: string): string {
  const message = cause instanceof Error ? cause.message : typeof cause === "string" ? cause : "";
  if (/safety system|content.?policy|safety.?filter|安全审核|内容审核/i.test(message)) {
    return "内容未通过模型安全审核，请调整描述后重试";
  }
  return message || fallback;
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
