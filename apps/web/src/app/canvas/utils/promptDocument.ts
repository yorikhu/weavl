import type { PromptPart } from "../types/nodes";

export interface CompiledPromptDocument {
  prompt: string;
  materialNodeIds: string[];
}

/**
 * 将画布提示词中的素材标签编译为不依赖用户命名的图片序号。
 * 同一素材重复出现时复用首次出现的编号，图片数组顺序与编号保持一致。
 *
 * @param text - 兼容旧节点的纯文本提示词。
 * @param parts - 新版有序提示词文档。
 * @param fallbackMaterialNodeIds - 旧节点保存的素材节点顺序。
 * @returns 供应商提示词及按首次出现排序的素材节点 ID。
 */
export function compilePromptDocument(
  text: string,
  parts: PromptPart[] | undefined,
  fallbackMaterialNodeIds: string[] = [],
): CompiledPromptDocument {
  if (parts?.some((part) => part.type === "asset")) {
    const indexes = new Map<string, number>();
    const materialNodeIds: string[] = [];
    const prompt = parts
      .map((part) => {
        if (part.type === "text") return part.text;
        let index = indexes.get(part.nodeId);
        if (!index) {
          materialNodeIds.push(part.nodeId);
          index = materialNodeIds.length;
          indexes.set(part.nodeId, index);
        }
        return `【图片 ${index}】`;
      })
      .join("");
    return { prompt, materialNodeIds };
  }

  const materialNodeIds = [...new Set(fallbackMaterialNodeIds)];
  if (!materialNodeIds.length) return { prompt: text, materialNodeIds };
  const references = materialNodeIds.map((_, index) => `【图片 ${index + 1}】`).join("、");
  return { prompt: `参考图片按顺序编号为${references}。\n${text}`, materialNodeIds };
}
