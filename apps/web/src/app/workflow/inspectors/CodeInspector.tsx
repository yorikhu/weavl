"use client";

import { useState } from "react";
import { Code2, LogIn, Maximize2, Minimize2, Minus, PlayCircle, Plus, Sparkles, X } from "lucide-react";
import styles from "./CodeInspector.module.scss";

/* ============================== 数据结构 ============================== */
export interface CodeVar {
  name: string;
  type: "str" | "int" | "float" | "bool";
  /** 输入变量的引用（来自上游节点，如 { nodeId: "start", key: "client_id" }） */
  ref?: { nodeId: string; key: string };
  description?: string;
}

export type CodeLanguage = "javascript" | "python";

export interface CodeErrorHandling {
  /** 整体执行超时（秒） */
  timeout: number;
  /** 重试次数（0 = 不重试） */
  retryTimes: number;
  /** 异常处理方式 */
  onError: "abort" | "default" | "ignore";
}

export interface CodeConfig {
  title?: string;
  description?: string;
  language: CodeLanguage;
  code: string;
  inputs: CodeVar[];
  outputs: CodeVar[];
  errorHandling?: CodeErrorHandling;
}

/**
 * 补齐代码节点配置的默认字段。
 *
 * @param c - 可能不完整的代码节点配置。
 * @returns 可供编辑器直接消费的完整配置。
 */
export function normalizeCodeConfig(c: Partial<CodeConfig>): CodeConfig {
  return {
    title: c.title,
    description: c.description,
    language: c.language ?? "javascript",
    code: c.code ?? "",
    inputs: c.inputs ?? [{ name: "input", type: "str" }],
    outputs: c.outputs ?? [{ name: "filename", type: "str" }],
    errorHandling: c.errorHandling ?? { timeout: 60, retryTimes: 0, onError: "abort" },
  };
}

/* ============================== 组件 ============================== */
interface Props {
  config: CodeConfig;
  onChange: (next: CodeConfig) => void;
}

const VAR_TYPES: Array<{ value: "str" | "int" | "float" | "bool"; label: string }> = [
  { value: "str", label: "String" },
  { value: "int", label: "Integer" },
  { value: "float", label: "Number" },
  { value: "bool", label: "Boolean" },
];

const LANGUAGES: Array<{ value: CodeLanguage; label: string }> = [
  { value: "javascript", label: "JavaScript" },
  { value: "python", label: "Python" },
];

const CODE_TEMPLATE: Record<CodeLanguage, string> = {
  javascript:
    "// 在这里，您可以通过 'args' 获取节点中的输入变量，并通过 'ret' 输出结果\n// params = args.params;\n// input = params['input'];\n\nasync function main(args) {\n  const params = args.params;\n  const ret = {\n    filename: params.input,\n  };\n  return ret;\n}",
  python:
    "# 在这里，您可以通过 'args' 获取节点中的输入变量，并通过 'ret' 输出结果\n# params = args.params\n# input = params['input']\n\nasync def main(args: Args) -> Output:\n    params = args.params\n    ret: Output = {\n        \"filename\": params[\"input\"],\n    }\n    return ret",
};

const RETRY_OPTIONS = [
  { value: 0, label: "不重试" },
  { value: 1, label: "重试 1 次" },
  { value: 2, label: "重试 2 次" },
  { value: 3, label: "重试 3 次" },
];

const ON_ERROR_OPTIONS = [
  { value: "abort", label: "中断流程" },
  { value: "default", label: "返回默认输出" },
  { value: "ignore", label: "忽略错误继续" },
] as const;

/**
 * 渲染代码节点配置面板。
 *
 * @param props - 组件属性。
 * @returns 代码节点检查器。
 */
export function CodeInspector({ config, onChange }: Props) {
  const [codeExpanded, setCodeExpanded] = useState(false);
  const [ideOpen, setIdeOpen] = useState(false);
  const eh = config.errorHandling ?? { timeout: 60, retryTimes: 0, onError: "abort" as const };

  const update = <K extends keyof CodeConfig>(k: K, v: CodeConfig[K]) => onChange({ ...config, [k]: v });

  const updateEh = (patch: Partial<CodeErrorHandling>) => update("errorHandling", { ...eh, ...patch });

  return (
    <div className={styles.inspectorBody}>
      {/* ============== 输入（参考扣子：变量名 | 变量值 | 操作） ============== */}
      <details open className={styles.inspectorGroup}>
        <summary className={styles.inspectorGroupHead}>
          <span>输入</span>
          <div className={styles.inspectorGroupRight}>
            <button
              className={styles.inspectorGroupBtn}
              aria-label="添加输入"
              title="添加输入"
              onClick={(e) => {
                e.preventDefault();
                update("inputs", [...config.inputs, { name: `var${config.inputs.length + 1}`, type: "str" }]);
              }}
            >
              <Plus size={12} />
            </button>
          </div>
        </summary>
        <div className={styles.inspectorVarList}>
          <div className={styles.inspectorVarHead}>
            <span>变量名</span>
            <span>变量值</span>
            <span style={{ width: 24 }} />
          </div>
          {config.inputs.map((v, i) => (
            <div key={i} className={styles.inputVarRow}>
              <input
                className={styles.inspectorVarInput}
                value={v.name}
                placeholder="输入参数名"
                onChange={(e) => {
                  const next = [...config.inputs];
                  next[i] = { ...v, name: e.target.value };
                  update("inputs", next);
                }}
              />
              <div className={styles.valueCol}>
                {/* 引用 chip：显示上游变量（开始-client_id） */}
                {v.ref ? (
                  <div className={styles.refChip} title={`${v.ref.nodeId}-${v.ref.key}`}>
                    <span className={styles.refDot} />
                    <span className={styles.refNode}>{v.ref.nodeId}</span>
                    <span className={styles.refSep}>·</span>
                    <span className={styles.refKey}>{v.ref.key}</span>
                    <button
                      className={styles.refClose}
                      aria-label="清除引用"
                      onClick={() => {
                        const next = [...config.inputs];
                        next[i] = { ...v, ref: undefined };
                        update("inputs", next);
                      }}
                    >
                      <X size={9} />
                    </button>
                  </div>
                ) : (
                  <input
                    className={styles.inspectorVarInput}
                    placeholder="引用变量或输入值"
                    value={v.description ?? ""}
                    onChange={(e) => {
                      const next = [...config.inputs];
                      next[i] = { ...v, description: e.target.value };
                      update("inputs", next);
                    }}
                  />
                )}
                {/* 类型 chip（透明 select 覆盖） */}
                <div className={styles.typeWrap} title={VAR_TYPES.find((t) => t.value === v.type)?.label}>
                  <span className={styles.typeChip} aria-hidden="true">
                    {VAR_TYPES.find((t) => t.value === v.type)?.label ?? "String"}
                  </span>
                  <select
                    className={styles.typeSelect}
                    value={v.type}
                    aria-label="变量类型"
                    onChange={(e) => {
                      const next = [...config.inputs];
                      next[i] = { ...v, type: e.target.value as CodeVar["type"] };
                      update("inputs", next);
                    }}
                  >
                    {VAR_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <button className={styles.inspectorGroupBtn} title="选择变量">
                  <Sparkles size={11} />
                </button>
              </div>
              <button
                className={styles.inspectorGroupBtn}
                aria-label="删除"
                onClick={() =>
                  update(
                    "inputs",
                    config.inputs.filter((_, k) => k !== i),
                  )
                }
              >
                <Minus size={11} />
              </button>
            </div>
          ))}
        </div>
      </details>

      {/* ============== 代码（CodeMirror 风格：等宽 + 深色编辑器） ============== */}
      <details open className={styles.inspectorGroup}>
        <summary className={styles.inspectorGroupHead}>
          <span>代码</span>
          <div className={styles.inspectorGroupRight}>
            <select
              className={styles.langSelect}
              value={config.language}
              onChange={(e) => {
                const lang = e.target.value as CodeLanguage;
                const old = CODE_TEMPLATE[config.language];
                const shouldSwap = !config.code.trim() || config.code === old;
                update("language", lang);
                if (shouldSwap) update("code", CODE_TEMPLATE[lang]);
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
            <button
              className={styles.inspectorGroupBtn}
              aria-label="插入模板"
              title="插入代码模板"
              onClick={(e) => {
                e.preventDefault();
                update("code", CODE_TEMPLATE[config.language]);
              }}
            >
              <LogIn size={12} />
            </button>
            <button
              className={styles.inspectorGroupBtn}
              aria-label={codeExpanded ? "收起" : "展开编辑"}
              title={codeExpanded ? "收起" : "展开编辑"}
              onClick={(e) => {
                e.preventDefault();
                setCodeExpanded((v) => !v);
              }}
            >
              {codeExpanded ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
            </button>
          </div>
        </summary>
        <div className={styles.inspectorGroupBody}>
          <div className={styles.codeWrap}>
            <textarea
              className={styles.codeEditor}
              rows={codeExpanded ? 20 : 10}
              spellCheck={false}
              placeholder="点击右上角插入代码模板…"
              value={config.code}
              onChange={(e) => update("code", e.target.value)}
            />
            <button className={styles.ideBtn} type="button" title="在 IDE 中编辑" onClick={() => setIdeOpen(true)}>
              <Maximize2 size={11} /> 在IDE中编辑
            </button>
          </div>
        </div>
      </details>

      {/* ============== 输出（变量名空时错误提示） ============== */}
      <details open className={styles.inspectorGroup}>
        <summary className={styles.inspectorGroupHead}>
          <span>输出</span>
          <div className={styles.inspectorGroupRight}>
            <button
              className={styles.inspectorGroupBtn}
              aria-label="添加输出"
              title="添加输出"
              onClick={(e) => {
                e.preventDefault();
                update("outputs", [...config.outputs, { name: "", type: "str" }]);
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
          {config.outputs.map((v, i) => {
            const hasError = !v.name.trim();
            return (
              <div key={i} className={styles.outputVarRowWrap}>
                <div className={styles.outputVarRow}>
                  <input
                    className={`${styles.inspectorVarInput} ${hasError ? styles.inputError : ""}`}
                    value={v.name}
                    placeholder="输入变量名"
                    aria-invalid={hasError}
                    onChange={(e) => {
                      const next = [...config.outputs];
                      next[i] = { ...v, name: e.target.value };
                      update("outputs", next);
                    }}
                  />
                  <div className={styles.typeWrap} title={VAR_TYPES.find((t) => t.value === v.type)?.label}>
                    <span className={styles.typeChip} aria-hidden="true">
                      {VAR_TYPES.find((t) => t.value === v.type)?.label ?? "String"}
                    </span>
                    <select
                      className={styles.typeSelect}
                      value={v.type}
                      aria-label="变量类型"
                      onChange={(e) => {
                        const next = [...config.outputs];
                        next[i] = { ...v, type: e.target.value as CodeVar["type"] };
                        update("outputs", next);
                      }}
                    >
                      {VAR_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    className={styles.inspectorGroupBtn}
                    aria-label="删除"
                    onClick={() =>
                      update(
                        "outputs",
                        config.outputs.filter((_, k) => k !== i),
                      )
                    }
                  >
                    <Minus size={11} />
                  </button>
                </div>
                {hasError && <div className={styles.errorText}>变量名不可为空</div>}
              </div>
            );
          })}
        </div>
      </details>

      {/* ============== 异常处理（参考扣子：超时 / 重试 / 处理方式） ============== */}
      <details open className={styles.inspectorGroup}>
        <summary className={styles.inspectorGroupHead}>
          <span>异常处理</span>
        </summary>
        <div className={styles.inspectorGroupBody}>
          <div className={styles.ehRow}>
            <span className={styles.ehLabel}>整体执行超时</span>
            <div className={styles.ehControl}>
              <input
                className={styles.ehInput}
                type="number"
                min={1}
                value={eh.timeout}
                onChange={(e) => updateEh({ timeout: Math.max(1, Number(e.target.value) || 60) })}
              />
              <span className={styles.ehSuffix}>s</span>
            </div>
          </div>
          <div className={styles.ehRow}>
            <span className={styles.ehLabel}>重试次数</span>
            <div className={styles.ehControl}>
              <select
                className={styles.ehSelect}
                value={eh.retryTimes}
                onChange={(e) => updateEh({ retryTimes: Number(e.target.value) })}
              >
                {RETRY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className={styles.ehRow}>
            <span className={styles.ehLabel}>异常处理方式</span>
            <div className={styles.ehControl}>
              <select
                className={styles.ehSelect}
                value={eh.onError}
                onChange={(e) => updateEh({ onError: e.target.value as CodeErrorHandling["onError"] })}
              >
                {ON_ERROR_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </details>

      {/* ============== IDE 全屏编辑窗口（参考扣子 biz-ide） ============== */}
      {ideOpen && (
        <div className={styles.ideOverlay} onClick={() => setIdeOpen(false)}>
          <div className={styles.idePanel} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="代码编辑器">
            <header className={styles.ideHeader}>
              <span className={styles.ideIcon}>
                <Code2 size={14} />
              </span>
              <span className={styles.ideTitle}>{config.title?.trim() || "main"}</span>
              <select
                className={styles.ideLang}
                value={config.language}
                onChange={(e) => {
                  const lang = e.target.value as CodeLanguage;
                  const old = CODE_TEMPLATE[config.language];
                  const shouldSwap = !config.code.trim() || config.code === old;
                  update("language", lang);
                  if (shouldSwap) update("code", CODE_TEMPLATE[lang]);
                }}
              >
                {LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>
                    语言 {l.label}
                  </option>
                ))}
              </select>
              <div className={styles.ideHeaderRight}>
                <button className={styles.ideTestBtn} type="button">
                  <PlayCircle size={13} /> 测试代码
                </button>
                <button
                  className={styles.ideCollapseBtn}
                  type="button"
                  aria-label="收起 IDE"
                  title="收起"
                  onClick={() => setIdeOpen(false)}
                >
                  <X size={16} />
                </button>
              </div>
            </header>
            <textarea
              className={styles.ideEditor}
              spellCheck={false}
              value={config.code}
              placeholder="点击左上角插入代码模板…"
              onChange={(e) => update("code", e.target.value)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
