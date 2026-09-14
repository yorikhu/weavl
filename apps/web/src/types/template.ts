import type { InputDef, Step } from "@weavl/shared";

/** templates API 列表返回的模板摘要 */
export interface TemplateSummary {
  id: string;
  name: string;
  vertical: string;
  category: "image" | "video" | "script" | "voice" | string;
  price: string;
  cost: { min: number; max: number };
  inputs: InputDef[];
  gates: { afterStep: string; title: string; description?: string; candidates?: number }[];
  totalSteps: number;
}

/** templates API 详情返回（GET /templates/:id）——含完整 steps/output */
export interface TemplateDetail extends TemplateSummary {
  steps: Step[];
}
