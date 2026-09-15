import type { Edge, Node } from "@xyflow/react";
import type { RunView } from "@weavl/shared";
import { STAGE_TITLES } from "../constants";

const STEP_IDS = ["topics", "copywriting", "cover-concept", "cover", "check", "package"] as const;

/**
 * 将最近一次工作流运行转换为可直接载入画布的节点和连线。
 *
 * @param run - 后端返回的工作流运行详情。
 * @returns 按阶段排列的 React Flow 节点与连线。
 */
export function buildLatestRunGraph(run: RunView): { nodes: Node[]; edges: Edge[] } {
  const gateSteps = new Set((run.decisions ?? []).map((decision) => decision.gate));
  const nodes: Node[] = STEP_IDS.map((stepId, index) => {
    const isGate = gateSteps.has(stepId);
    const position = { x: 80, y: 80 + index * 200 };
    const id = `s_${stepId}`;

    if (stepId === "cover" || stepId === "cover-concept") {
      return {
        id,
        type: "image",
        position,
        data: {
          nodeKind: "image",
          kind: "image",
          title: STAGE_TITLES[stepId],
          category: isGate ? "确认门 · 封面" : "封面",
          tint: "rgba(212, 83, 126, 0.18)",
          size: { w: 200, h: 260 },
        },
      };
    }

    if (stepId === "package" && run.contentPackage) {
      return {
        id,
        type: "card",
        position,
        data: {
          nodeKind: "card",
          kind: "output",
          title: "内容包",
          category: "产物",
          fields: [
            { label: "标题", value: run.contentPackage.fields[0]?.value?.slice(0, 28) ?? "—" },
            { label: "正文", value: run.contentPackage.fields[1]?.value?.slice(0, 28) ?? "—" },
            { label: "封面", value: run.contentPackage.fields[2]?.value?.slice(0, 28) ?? "—" },
            { label: "话题", value: run.contentPackage.fields[3]?.value?.slice(0, 28) ?? "—" },
          ],
        },
      };
    }

    return {
      id,
      type: "card",
      position,
      data: {
        nodeKind: "card",
        kind: "llm",
        title: STAGE_TITLES[stepId],
        category: isGate ? `确认门 · ${STAGE_TITLES[stepId]}` : STAGE_TITLES[stepId],
        isGate,
        fields: [
          { label: "类型", value: "测评/故事/清单" },
          { label: "候选", value: "3 个" },
          { label: "状态", value: isGate ? "等待确认" : "已确认" },
        ],
      },
    };
  });

  const edges: Edge[] = STEP_IDS.slice(0, -1).map((stepId, index) => ({
    id: `e_${stepId}`,
    source: `s_${stepId}`,
    target: `s_${STEP_IDS[index + 1]}`,
    type: "smoothstep",
    style: { stroke: "#5e5e66", strokeWidth: 1.2 },
    label: index % 2 === 0 ? "点击按钮，可替换上传" : undefined,
    labelStyle: { fill: "#a8a8b2", fontSize: 10 },
    labelBgStyle: { fill: "rgba(20, 20, 22, 0.92)", stroke: "#232326" },
    labelBgPadding: [6, 4] as [number, number],
    labelBgBorderRadius: 8,
  }));

  return { nodes, edges };
}
