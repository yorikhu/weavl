"use client";

import { useState } from "react";
import {
  ChevronDown,
  Copy,
  LogIn,
  Maximize2,
  Minimize2,
  Plus,
  Settings,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import type { ModelRef } from "@weavl/shared";
import styles from "./LLMInspector.module.scss";

/* ============================== 数据结构 ============================== */
export interface LLMVar {
  name: string;
  type: "int" | "str" | "bool" | "float";
  required: boolean;
  ref?: { nodeId: string; key: string };
  default?: string;
  description?: string;
}

export interface LLMSkillItem {
  id: string;
  name: string;
  icon?: string;
}

export interface LLMConfig {
  title?: string;
  description?: string;
  batchMode: "single" | "batch";
  model: ModelRef;
  systemPrompt: string;
  userPrompt: string;
  inputs: LLMVar[];
  batchInputLists: Array<{ name: string; items: string; itemType?: BatchItemType }>;
  visionInputs: LLMVar[];
  outputFormat: "markdown" | "json";
  outputs: Array<{ name: string; type: "str" | "int" | "float" | "bool"; description?: string }>;
  skills: LLMSkillItem[];
}

/** 缺失字段兜底 */
export function normalizeLlmConfig(c: Partial<LLMConfig> & { model: ModelRef }): LLMConfig {
  return {
    title: c.title,
    description: c.description,
    batchMode: c.batchMode ?? "single",
    model: c.model,
    systemPrompt: c.systemPrompt ?? "",
    userPrompt: c.userPrompt ?? "",
    inputs: c.inputs ?? [],
    batchInputLists: c.batchInputLists ?? [{ name: "item1", items: "", itemType: "str" }],
    visionInputs: c.visionInputs ?? [],
    outputFormat: c.outputFormat ?? "markdown",
    outputs:
      c.outputs ??
      ((c as { output?: LLMVar }).output
        ? [
            {
              name: ((c as { output?: LLMVar }).output as LLMVar)?.name ?? "output",
              type: "str",
            },
          ]
        : [{ name: "output", type: "str" }]),
    skills: c.skills ?? [],
  };
}

/* ============================== 组件 ============================== */
interface Props {
  config: LLMConfig;
  onChange: (next: LLMConfig) => void;
}

const MODEL_PRESETS: Array<{ label: string; value: string }> = [
  { label: "豆包 · 2.0 · pro", value: "doubao-2.0-pro" },
  { label: "豆包 · 1.5 · pro", value: "doubao-1.5-pro" },
  { label: "GPT-4o", value: "gpt-4o" },
  { label: "Claude 3.5 Sonnet", value: "claude-3.5-sonnet" },
];

const OUTPUT_TYPES: Array<{ value: "str" | "int" | "float" | "bool"; label: string }> = [
  { value: "str", label: "str. String" },
  { value: "int", label: "int. Integer" },
  { value: "float", label: "num. Number" },
  { value: "bool", label: "bool. Boolean" },
];

/** 批处理变量类型（参考扣子：String / Integer / Number / Boolean / Time / Object / File） */
const BATCH_ITEM_TYPES: Array<{ value: BatchItemType; label: string }> = [
  { value: "str", label: "String" },
  { value: "int", label: "Integer" },
  { value: "float", label: "Number" },
  { value: "bool", label: "Boolean" },
  { value: "time", label: "Time" },
  { value: "object", label: "Object" },
  { value: "file", label: "File" },
];

export type BatchItemType = "str" | "int" | "float" | "bool" | "time" | "object" | "file";

export function LLMInspector({ config, onChange }: Props) {
  const [modelOpen, setModelOpen] = useState(false);
  const [expandedVars, setExpandedVars] = useState<Set<number>>(new Set());

  const update = <K extends keyof LLMConfig>(k: K, v: LLMConfig[K]) => onChange({ ...config, [k]: v });

  const modelLabel = (m: ModelRef): string => {
    if ("provider" in m) return `${m.provider} · ${m.model}`;
    return m.alias;
  };

  const toggleVar = (i: number) =>
    setExpandedVars((s) => {
      const next = new Set(s);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  return (
    <div className={styles.inspectorBody}>
      {/* ============== 批处理模式（固定区域） ============== */}
      <div className={styles.batchRow}>
        <span className={styles.batchLabel}>批处理模式</span>
        <div className={styles.batchToggle}>
          <button
            className={`${styles.batchBtn} ${config.batchMode === "single" ? styles.batchBtnActive : ""}`}
            onClick={() => update("batchMode", "single")}
            type="button"
          >
            单次
          </button>
          <button
            className={`${styles.batchBtn} ${config.batchMode === "batch" ? styles.batchBtnActive : ""}`}
            onClick={() => update("batchMode", "batch")}
            type="button"
          >
            批处理
          </button>
        </div>
      </div>

      {/* ============== 批处理列表（仅 batch） ============== */}
      {config.batchMode === "batch" && (
        <details open className={styles.inspectorGroup}>
          <summary className={styles.inspectorGroupHead}>
            <span>批处理</span>
            <div className={styles.inspectorGroupRight}>
              <button className={styles.inspectorGroupBtn} aria-label="批处理设置" title="批处理设置">
                <Settings size={12} />
              </button>
            </div>
          </summary>
          <div className={styles.inspectorVarList}>
            <div className={styles.inspectorVarHead}>
              <span>变量名</span>
              <span>变量值</span>
              <span></span>
            </div>
            {config.batchInputLists.map((b, i) => (
              <BatchRow
                key={i}
                v={b}
                canDelete={config.batchInputLists.length > 1}
                onChange={(nv) => {
                  const next = [...config.batchInputLists];
                  next[i] = nv;
                  update("batchInputLists", next);
                }}
                onDelete={() =>
                  update(
                    "batchInputLists",
                    config.batchInputLists.filter((_, k) => k !== i),
                  )
                }
              />
            ))}
            <button
              className={styles.addRowBtn}
              onClick={() =>
                update("batchInputLists", [
                  ...config.batchInputLists,
                  { name: `item${config.batchInputLists.length + 1}`, items: "", itemType: "str" },
                ])
              }
              type="button"
            >
              <Plus size={11} /> 添加批处理项
            </button>
          </div>
        </details>
      )}

      {/* ============== 模型 ============== */}
      <details open className={styles.inspectorGroup}>
        <summary className={styles.inspectorGroupHead}>
          <span>模型</span>
          <div className={styles.inspectorGroupRight}>
            <button className={styles.inspectorGroupBtn} aria-label="模型参数" title="模型参数">
              <Settings size={12} />
            </button>
          </div>
        </summary>
        <div className={styles.inspectorGroupBody}>
          <div className={styles.modelWrap}>
            <div className={styles.modelRow}>
              <button className={styles.modelBtn} onClick={() => setModelOpen((v) => !v)} type="button">
                <span className={styles.modelDot} />
                <span className={styles.modelName}>{modelLabel(config.model)}</span>
                <ChevronDown size={12} />
              </button>
            </div>
            {modelOpen && (
              <div className={styles.modelMenu}>
                {MODEL_PRESETS.map((p) => (
                  <button
                    key={p.value}
                    className={styles.modelItem}
                    onClick={() => {
                      update("model", { provider: "doubao", model: p.value });
                      setModelOpen(false);
                    }}
                    type="button"
                  >
                    <span className={styles.modelDot} />
                    {p.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </details>

      {/* ============== 技能 ============== */}
      <details open className={styles.inspectorGroup}>
        <summary className={styles.inspectorGroupHead}>
          <span>技能</span>
          <div className={styles.inspectorGroupRight}>
            <button
              className={styles.inspectorGroupBtn}
              aria-label="添加技能"
              title="添加技能"
              onClick={(e) => {
                e.preventDefault();
                update("skills", [
                  ...config.skills,
                  {
                    id: `skill-${Date.now()}`,
                    name: `技能${config.skills.length + 1}`,
                    icon: "📚",
                  },
                ]);
              }}
            >
              <Plus size={12} />
            </button>
          </div>
        </summary>
        <div className={styles.inspectorGroupBody}>
          {config.skills.length === 0 ? (
            <div className={styles.skillEmpty}>
              <span>暂未配置技能</span>
              <p>技能用于扩展模型能力（如联网搜索、知识库检索）</p>
            </div>
          ) : (
            <div className={styles.skillList}>
              {config.skills.map((s, i) => (
                <div key={s.id} className={styles.skillCard}>
                  <span className={styles.skillIcon}>{s.icon ?? "📚"}</span>
                  <span className={styles.skillName}>{s.name}</span>
                  <div className={styles.skillActions}>
                    <button className={styles.inspectorGroupBtn} title="复制">
                      <Copy size={11} />
                    </button>
                    <button className={styles.inspectorGroupBtn} title="设置">
                      <Settings size={11} />
                    </button>
                    <button
                      className={styles.inspectorGroupBtn}
                      title="删除"
                      onClick={() =>
                        update(
                          "skills",
                          config.skills.filter((_, k) => k !== i),
                        )
                      }
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </details>

      {/* ============== 输入 ============== */}
      <details open className={styles.inspectorGroup}>
        <summary className={styles.inspectorGroupHead}>
          <span>输入</span>
          <div className={styles.inspectorGroupRight}>
            <button className={styles.inspectorGroupBtn} aria-label="JSON 导入" title="JSON 导入">
              <LogIn size={12} />
            </button>
            <button
              className={styles.inspectorGroupBtn}
              aria-label="添加输入参数"
              title="添加输入参数"
              onClick={(e) => {
                e.preventDefault();
                update("inputs", [
                  ...config.inputs,
                  { name: `var${config.inputs.length + 1}`, type: "str", required: true },
                ]);
              }}
            >
              <Plus size={12} />
            </button>
          </div>
        </summary>
        <div className={styles.inspectorVarList}>
          <div className={styles.inspectorVarHead}>
            <span>变量名</span>
            <span>变量类型</span>
            <span style={{ width: 24 }} />
          </div>
          {config.inputs.map((v, i) => (
            <InputVarRow
              key={i}
              v={v}
              expanded={expandedVars.has(i)}
              onToggle={() => toggleVar(i)}
              onChange={(nv) => {
                const next = [...config.inputs];
                next[i] = nv;
                update("inputs", next);
              }}
              onDelete={() =>
                update(
                  "inputs",
                  config.inputs.filter((_, k) => k !== i),
                )
              }
            />
          ))}
        </div>
      </details>

      {/* ============== 视觉理解输入 ============== */}
      <details open className={styles.inspectorGroup}>
        <summary className={styles.inspectorGroupHead}>
          <span>视觉理解输入</span>
          <div className={styles.inspectorGroupRight}>
            <button
              className={`${styles.inspectorGroupBtn} ${styles.inspectorGroupBtnDisabled}`}
              aria-label="不支持"
              title="当前模型不支持视觉理解"
              disabled
            >
              <Plus size={12} />
            </button>
          </div>
        </summary>
        <div className={styles.inspectorGroupBody}>
          <div className={styles.visionEmpty}>
            <span>当前模型不支持视觉理解</span>
            <p>切换到支持视觉的模型后可启用图片输入</p>
          </div>
        </div>
      </details>

      {/* ============== 系统提示词 ============== */}
      <details open className={styles.inspectorGroup}>
        <summary className={styles.inspectorGroupHead}>
          <span>系统提示词</span>
          <div className={styles.inspectorGroupRight}>
            <button className={styles.inspectorGroupBtn} title="循环引用">
              <Wand2 size={11} />
            </button>
            <button className={styles.inspectorGroupBtn} title="提交到提示词库">
              <LogIn size={11} />
            </button>
            <button className={styles.inspectorGroupBtn} title="从提示词库选择">
              <Sparkles size={11} />
            </button>
            <button className={styles.inspectorGroupBtn} title="全屏编辑">
              <Maximize2 size={11} />
            </button>
            <button className={`${styles.inspectorGroupBtn} ${styles.aiBtn}`} title="AI 优化">
              <span className={styles.aiDot}>AI</span>
            </button>
          </div>
        </summary>
        <div className={styles.inspectorGroupBody}>
          <textarea
            className={styles.inspectorTextarea}
            rows={6}
            placeholder="你是一名证券投顾…&#10;使用 {{变量名}} 引用输入参数"
            value={config.systemPrompt}
            onChange={(e) => update("systemPrompt", e.target.value)}
          />
        </div>
      </details>

      {/* ============== 用户提示词 ============== */}
      <details open className={styles.inspectorGroup}>
        <summary className={styles.inspectorGroupHead}>
          <span>用户提示词</span>
        </summary>
        <div className={styles.inspectorGroupBody}>
          <textarea
            className={styles.inspectorTextarea}
            rows={4}
            placeholder="用户提示词，可以使用 {{变量名}}、{{变量名.子变量名}}、{{变量名[数组索引]}} 的方式引用输入参数中的变量"
            value={config.userPrompt}
            onChange={(e) => update("userPrompt", e.target.value)}
          />
        </div>
      </details>

      {/* ============== 输出 ============== */}
      <details open className={styles.inspectorGroup}>
        <summary className={styles.inspectorGroupHead}>
          <span>输出</span>
          <div className={styles.inspectorGroupRight}>
            <select
              className={styles.formatSelect}
              value={config.outputFormat}
              onChange={(e) => update("outputFormat", e.target.value as "markdown" | "json")}
              onClick={(e) => e.stopPropagation()}
            >
              <option value="markdown">Markdown</option>
              <option value="json">JSON</option>
            </select>
            <button
              className={styles.inspectorGroupBtn}
              aria-label="添加输出变量"
              title="添加输出变量"
              onClick={(e) => {
                e.preventDefault();
                update("outputs", [...config.outputs, { name: `output${config.outputs.length + 1}`, type: "str" }]);
              }}
            >
              <Plus size={12} />
            </button>
          </div>
        </summary>
        <div className={styles.inspectorVarList}>
          <div className={styles.inspectorVarHead}>
            <span style={{ gridColumn: "span 2" }}>变量名</span>
            <span>类型</span>
            <span style={{ width: 24 }} />
          </div>
          {config.outputs.map((o, i) => (
            <OutputVarRow
              key={i}
              v={o}
              onChange={(nv) => {
                const next = [...config.outputs];
                next[i] = nv;
                update("outputs", next);
              }}
              onDelete={() =>
                update(
                  "outputs",
                  config.outputs.filter((_, k) => k !== i),
                )
              }
            />
          ))}
        </div>
      </details>
    </div>
  );
}

/* ============================== 输入变量行（可展开：默认值 + 描述） ============================== */
function InputVarRow({
  v,
  expanded,
  onToggle,
  onChange,
  onDelete,
}: {
  v: LLMVar;
  expanded: boolean;
  onToggle: () => void;
  onChange: (nv: LLMVar) => void;
  onDelete: () => void;
}) {
  return (
    <>
      <div className={styles.inspectorVarRow}>
        <input
          className={styles.inspectorVarInput}
          value={v.name}
          onChange={(e) => onChange({ ...v, name: e.target.value })}
          placeholder="输入参数名"
        />
        <select
          className={styles.inspectorVarSelect}
          value={v.type}
          onChange={(e) => onChange({ ...v, type: e.target.value as LLMVar["type"] })}
        >
          {OUTPUT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <button
          className={`${styles.inspectorCheck} ${v.required ? styles.inspectorCheckOn : ""}`}
          onClick={() => onChange({ ...v, required: !v.required })}
          aria-label="必填"
          title="必填"
        >
          {v.required ? "✓" : ""}
        </button>
        <div className={styles.inspectorVarActions}>
          <button
            className={`${styles.inspectorGroupBtn} ${expanded ? styles.inspectorGroupBtnActive : ""}`}
            aria-label={expanded ? "收起" : "展开参数"}
            onClick={onToggle}
          >
            {expanded ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
          </button>
          <button className={styles.inspectorGroupBtn} aria-label="删除" onClick={onDelete}>
            <X size={11} />
          </button>
        </div>
      </div>
      {expanded && (
        <div className={styles.inspectorVarExpand}>
          <div className={styles.inspectorVarField}>
            <label className={styles.inspectorVarFieldLabel}>默认值</label>
            <input
              className={styles.inspectorVarInput}
              placeholder="参数默认值，在没有传入该参数时，将使用默认值"
              value={v.default ?? ""}
              onChange={(e) => onChange({ ...v, default: e.target.value })}
            />
          </div>
          <div className={styles.inspectorVarField}>
            <label className={styles.inspectorVarFieldLabel}>描述</label>
            <input
              className={styles.inspectorVarInput}
              placeholder="帮助大模型准确了解参数的作用"
              value={v.description ?? ""}
              onChange={(e) => onChange({ ...v, description: e.target.value })}
            />
          </div>
        </div>
      )}
    </>
  );
}

/* ============================== 输出变量行 ============================== */
function OutputVarRow({
  v,
  onChange,
  onDelete,
}: {
  v: { name: string; type: "str" | "int" | "float" | "bool"; description?: string };
  onChange: (nv: { name: string; type: "str" | "int" | "float" | "bool"; description?: string }) => void;
  onDelete: () => void;
}) {
  return (
    <div className={styles.inspectorVarRow} style={{ gridTemplateColumns: "1fr 1fr 32px 56px" }}>
      <input
        className={styles.inspectorVarInput}
        style={{ gridColumn: "span 2" }}
        placeholder="输出变量名"
        value={v.name}
        onChange={(e) => onChange({ ...v, name: e.target.value })}
      />
      <select
        className={styles.inspectorVarSelect}
        value={v.type}
        onChange={(e) => onChange({ ...v, type: e.target.value as "str" | "int" | "float" | "bool" })}
      >
        {OUTPUT_TYPES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>
      <button className={styles.inspectorGroupBtn} aria-label="删除" onClick={onDelete}>
        <Trash2 size={11} />
      </button>
    </div>
  );
}

/* ============================== 批处理行（数组类型 + JSON 变量值） ============================== */
function BatchRow({
  v,
  canDelete,
  onChange,
  onDelete,
}: {
  v: { name: string; items: string; itemType?: BatchItemType };
  canDelete: boolean;
  onChange: (nv: { name: string; items: string; itemType?: BatchItemType }) => void;
  onDelete: () => void;
}) {
  const itemType = v.itemType ?? "str";
  const typeLabel = BATCH_ITEM_TYPES.find((t) => t.value === itemType)?.label ?? "String";
  const itemPlaceholder =
    itemType === "str"
      ? '["item1", "item2"]'
      : itemType === "int" || itemType === "float"
        ? "[1, 2, 3]"
        : itemType === "bool"
          ? "[true, false]"
          : itemType === "object"
            ? '[{"key": "value"}]'
            : itemType === "file"
              ? '["https://..."]'
              : '["2024-01-01"]';
  return (
    <div className={styles.inspectorVarRow} style={{ gridTemplateColumns: "1fr 2fr 32px" }}>
      <input
        className={styles.inspectorVarInput}
        value={v.name}
        onChange={(e) => onChange({ ...v, name: e.target.value })}
        placeholder="参数名"
      />
      <div className={styles.batchValueCol}>
        {/* 数组类型 chip：select 透明覆盖在 chip 上，点击直接弹原生下拉 */}
        <div className={styles.arrayTypeWrap} title={`Array<${typeLabel}>`}>
          <span className={styles.arrayTypeChip} aria-hidden="true">
            <span className={styles.arrayBracket}>[</span>
            <span className={styles.arrayTypeLabel}>{typeLabel}</span>
            <span className={styles.arrayBracket}>]</span>
            <ChevronDown size={10} className={styles.arrayChevron} />
          </span>
          <select
            className={styles.batchTypeSelect}
            value={itemType}
            onChange={(e) => onChange({ ...v, itemType: e.target.value as BatchItemType })}
            aria-label={`Array<${typeLabel}>，选择类型`}
          >
            {BATCH_ITEM_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                [{t.label}]
              </option>
            ))}
          </select>
        </div>
        <textarea
          className={styles.batchJson}
          placeholder={itemPlaceholder}
          value={v.items}
          onChange={(e) => onChange({ ...v, items: e.target.value })}
          rows={1}
        />
        <button className={styles.inspectorGroupBtn} title="选择变量">
          <Sparkles size={11} />
        </button>
      </div>
      <button
        className={`${styles.inspectorGroupBtn} ${!canDelete ? styles.inspectorGroupBtnDisabled : ""}`}
        aria-label="删除"
        title={canDelete ? "删除" : "至少保留一项"}
        onClick={canDelete ? onDelete : undefined}
        disabled={!canDelete}
      >
        <X size={11} />
      </button>
    </div>
  );
}
