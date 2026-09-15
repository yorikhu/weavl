import type { AssetKind } from "@weavl/shared";
import type { Node } from "@xyflow/react";

export interface NodeAssetPayload {
  name: string;
  kind: AssetKind;
  content: string;
  mimeType: string;
}

function getNodeName(data: Record<string, unknown>): string {
  if (typeof data.title !== "string") return "画布节点";
  return data.title.trim() || "画布节点";
}

function getMediaPayload(data: Record<string, unknown>, name: string, kind: "image" | "video"): NodeAssetPayload {
  const url = typeof data.url === "string" ? data.url : "";
  const content = url || JSON.stringify(data);
  const mimeType = url.startsWith(`data:${kind}/`) ? `${kind}/*` : "application/json";
  return { name, kind, content, mimeType };
}

function getTextContent(data: Record<string, unknown>): string {
  if (typeof data.text === "string") return data.text;
  if (!Array.isArray(data.fields)) return JSON.stringify(data, null, 2);

  return data.fields
    .map((field) => {
      const item = field as { label?: string; value?: string };
      return `${item.label ?? ""}：${item.value ?? ""}`;
    })
    .join("\n");
}

/**
 * 将任意画布节点转换为可写入全局资产库的请求数据。
 * 媒体节点优先保留资源地址，文本和结构化节点会转换为可读文本。
 *
 * @param node - 要保存的 React Flow 节点。
 * @returns 资产名称、类型、内容和 MIME 类型。
 */
export function nodeAssetPayload(node: Node): NodeAssetPayload {
  const data = node.data as Record<string, unknown>;
  const name = getNodeName(data);
  if (data.nodeKind === "image") return getMediaPayload(data, name, "image");
  if (data.nodeKind === "video") return getMediaPayload(data, name, "video");
  return { name, kind: "text", content: getTextContent(data), mimeType: "text/plain" };
}
