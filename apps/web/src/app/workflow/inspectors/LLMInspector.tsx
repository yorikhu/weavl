"use client";

import { useState, type CSSProperties } from "react";
import { ChevronDown, Maximize2, Minimize2, Plus, X } from "lucide-react";
import type { ModelRef } from "@weavl/shared";
import styles from "./LLMInspector.module.scss";

/* ============================== 数据结构 ============================== */
export interface LLMVar {
  name: string;
  type: "int" | "str" | "bool" | "float";
  required: boolean;
  default?: string;
  description?: string;
}
export interface LLMConfig {
  model: ModelRef;
  systemPrompt: string;
  userPrompt: string;
  inputs: LLMVar[];
  output: { name: string; type: "str"; required: boolean; description?: string };
  skills: string[];
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

export function LLMInspector({ config, onChange }: Props) {
  const [openSections, setOpenSections] = useState<Set<string>>(
    new Set(["model", "systemPrompt", "inputs", "output"]),
  );
  const [expandedVars, setExpandedVars] = useState<Set<number>>(new Set());
  const [modelOpen, setModelOpen] = useState(false);

  const toggle = (key: string) => {
    setOpenSections((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  const toggleVar = (i: number) => {
    setExpandedVars((s) => {
      const next = new Set(s);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const update = <K extends keyof LLMConfig>(k: K, v: LLMConfig[K]) =>
    onChange({ ...config, [k]: v });

  const modelLabel = (m: ModelRef): string => {
    if ("provider" in m) return `${m.provider} · ${m.model}`;
    return m.alias;
  };

  return (
    <div className={styles.inspector}>
      <Section
        icon="🧠"
        title="模型"
        open={openSections.has("model")}
        onToggle={() => toggle("model")}
      >
        <div className={styles.modelWrap}>
          <button
            className={styles.modelBtn}
            onClick={() => setModelOpen((v) => !v)}
            type="button"
          >
            <span className={styles.modelDot} />
            {modelLabel(config.model)}
            <ChevronDown size={12} />
          </button>
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
                >
                  <span className={styles.modelDot} />
                  {p.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </Section>

      <Section
        icon="💬"
        title="系统提示词"
        open={openSections.has("systemPrompt")}
        onToggle={() => toggle("systemPrompt")}
      >
        <textarea
          className={styles.textarea}
          rows={5}
          placeholder="设定模型的角色、能力和输出风格…"
          value={config.systemPrompt}
          onChange={(e) => update("systemPrompt", e.target.value)}
        />
        <div className={styles.iconRow}>
          <button className={styles.iconBtn} title="插入变量">＋</button>
          <button className={styles.iconBtn} title="优化">✨</button>
          <button className={styles.iconBtn} title="引用">💡</button>
          <button className={styles.iconBtn} title="全屏">⛶</button>
          <button className={styles.iconBtn} title="高级">＋</button>
        </div>
      </Section>

      <Section
        icon="✏️"
        title="用户提示词"
        open={openSections.has("userPrompt")}
        onToggle={() => toggle("userPrompt")}
      >
        <textarea
          className={styles.textarea}
          rows={4}
          placeholder="使用 {{变量名}} 引用输入参数…"
          value={config.userPrompt}
          onChange={(e) => update("userPrompt", e.target.value)}
        />
      </Section>

      <Section
        icon="📥"
        title="输入"
        open={openSections.has("inputs")}
        onToggle={() => toggle("inputs")}
        right={
          <button
            className={styles.iconBtn}
            onClick={() =>
              update("inputs", [
                ...config.inputs,
                { name: `var${config.inputs.length + 1}`, type: "str", required: true },
              ])
            }
            title="添加变量"
          >
            <Plus size={12} />
          </button>
        }
      >
        <div className={styles.varList}>
          <div className={styles.varHead}>
            <span>变量名</span>
            <span>变量类型</span>
            <span>必填</span>
            <span></span>
          </div>
          {config.inputs.map((v, i) => (
            <VarRow
              key={i}
              v={v}
              expanded={expandedVars.has(i)}
              onToggle={() => toggleVar(i)}
              onChange={(nv) => {
                const next = [...config.inputs];
                next[i] = nv;
                update("inputs", next);
              }}
              onDelete={() => update("inputs", config.inputs.filter((_, k) => k !== i))}
            />
          ))}
        </div>
      </Section>

      <Section
        icon="📤"
        title="输出"
        open={openSections.has("output")}
        onToggle={() => toggle("output")}
      >
        <div className={styles.varList}>
          <div className={styles.varHead}>
            <span>变量名</span>
            <span>变量类型</span>
            <span>必填</span>
            <span></span>
          </div>
          <div className={styles.varRow}>
            <input
              className={styles.input}
              value={config.output.name}
              onChange={(e) =>
                update("output", { ...config.output, name: e.target.value })
              }
            />
            <select
              className={styles.select}
              value={config.output.type}
              onChange={(e) =>
                update("output", { ...config.output, type: e.target.value as "str" })
              }
            >
              <option value="str">str. String</option>
              <option value="int">int. Integer</option>
              <option value="float">num. Number</option>
              <option value="bool">bool. Boolean</option>
            </select>
            <button
              className={`${styles.check} ${config.output.required ? styles.checkOn : ""}`}
              onClick={() =>
                update("output", { ...config.output, required: !config.output.required })
              }
            >
              {config.output.required ? "✓" : ""}
            </button>
            <div className={styles.varActions}>
              <button className={styles.iconBtn}><Maximize2 size={11} /></button>
            </div>
          </div>
        </div>
      </Section>

      <Section
        icon="🛠️"
        title="技能"
        open={openSections.has("skills")}
        onToggle={() => toggle("skills")}
        right={
          <button className={styles.iconBtn} title="添加技能">
            <Plus size={12} />
          </button>
        }
      >
        <div className={styles.skillEmpty}>
          <span>暂未配置技能</span>
          <p>技能用于扩展模型能力（如联网搜索、知识库检索）</p>
        </div>
      </Section>

      <Section
        icon="⚠️"
        title="异常处理"
        open={openSections.has("error")}
        onToggle={() => toggle("error")}
      >
        <label className={styles.fieldRow}>
          <span>失败时</span>
          <select className={styles.select}>
            <option>中断流程</option>
            <option>重试 3 次</option>
            <option>返回默认输出</option>
          </select>
        </label>
      </Section>
    </div>
  );
}

/* ============================== 折叠 Section ============================== */
function Section({
  icon,
  title,
  open,
  onToggle,
  children,
  right,
}: {
  icon: string;
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionHead} onClick={onToggle}>
        <span className={styles.chev}>{open ? "▾" : "▸"}</span>
        <span className={styles.icon}>{icon}</span>
        <span className={styles.title}>{title}</span>
        {right && <div className={styles.sectionRight} onClick={(e) => e.stopPropagation()}>{right}</div>}
      </div>
      {open && <div className={styles.sectionBody}>{children}</div>}
    </div>
  );
}

/* ============================== 变量行 ============================== */
function VarRow({
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
    <div className={styles.varGroup}>
      <div className={styles.varRow}>
        <input
          className={styles.input}
          value={v.name}
          onChange={(e) => onChange({ ...v, name: e.target.value })}
        />
        <select
          className={styles.select}
          value={v.type}
          onChange={(e) => onChange({ ...v, type: e.target.value as LLMVar["type"] })}
        >
          <option value="str">str. String</option>
          <option value="int">int. Integer</option>
          <option value="float">num. Number</option>
          <option value="bool">bool. Boolean</option>
        </select>
        <button
          className={`${styles.check} ${v.required ? styles.checkOn : ""}`}
          onClick={() => onChange({ ...v, required: !v.required })}
        >
          {v.required ? "✓" : ""}
        </button>
        <div className={styles.varActions}>
          <button className={styles.iconBtn} onClick={onToggle}>
            {expanded ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
          </button>
          <button className={styles.iconBtn} onClick={onDelete}>
            <X size={11} />
          </button>
        </div>
      </div>
      {expanded && (
        <div className={styles.varExpand}>
          <div className={styles.subField}>
            <label>默认值</label>
            <input
              className={styles.input}
              placeholder="参数默认值，在没有传入该参数时，将使用默认值"
              value={v.default ?? ""}
              onChange={(e) => onChange({ ...v, default: e.target.value })}
            />
          </div>
          <div className={styles.subField}>
            <label>描述</label>
            <input
              className={styles.input}
              placeholder="帮助大模型准确了解参数的作用"
              value={v.description ?? ""}
              onChange={(e) => onChange({ ...v, description: e.target.value })}
            />
          </div>
        </div>
      )}
    </div>
  );
}
