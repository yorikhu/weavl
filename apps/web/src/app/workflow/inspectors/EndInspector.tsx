"use client";

import { useCallback, useState } from "react";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import styles from "./EndInspector.module.scss";

/* ========================================================================
 * 结束节点 Inspector（参考扣子截图）
 *
 * 布局：
 *   - 头部（由 page.tsx 渲染）
 *   - 描述
 *   - 核心 radio：返回变量 / 返回文本
 *   - 折叠 1: 输出变量（variables 模式）
 *   - 折叠 2: 回答内容（text 模式，含流式输出开关 + textarea）
 * ====================================================================== */

export type EndMode = "variables" | "text";

export interface EndOutputVar {
  name: string;
  ref: string; /* 引用上游节点的变量路径，如 "大模型.output" */
}

export interface EndNodeData {
  id: string;
  mode: EndMode;
  outputs: EndOutputVar[];
  text: string;
  streaming: boolean;
  /** 用户自定义描述（可选；为空时回退到 NODE_META.end.desc） */
  description?: string;
}

interface Props {
  data: EndNodeData;
  onChange: (next: EndNodeData) => void;
}

export default function EndInspector({ data, onChange }: Props) {
  /* 输出变量/回答内容 折叠状态（默认展开） */
  const [outputsOpen, setOutputsOpen] = useState(true);
  const [textOpen, setTextOpen] = useState(true);

  const setMode = useCallback((mode: EndMode) => onChange({ ...data, mode }), [data, onChange]);
  const setStreaming = useCallback((streaming: boolean) => onChange({ ...data, streaming }), [data, onChange]);
  const setText = useCallback((text: string) => onChange({ ...data, text }), [data, onChange]);

  /* 输出变量 CRUD */
  const addOutput = useCallback(() => {
    const next: EndOutputVar[] = [...data.outputs, { name: `output${data.outputs.length + 1}`, ref: "" }];
    onChange({ ...data, outputs: next });
  }, [data, onChange]);
  const removeOutput = useCallback(
    (i: number) => {
      onChange({ ...data, outputs: data.outputs.filter((_, k) => k !== i) });
    },
    [data, onChange],
  );
  const updateOutput = useCallback(
    (i: number, patch: Partial<EndOutputVar>) => {
      onChange({
        ...data,
        outputs: data.outputs.map((o, k) => (k === i ? { ...o, ...patch } : o)),
      });
    },
    [data, onChange],
  );

  return (
    <div className={styles.inspectorBody}>
      {/* 描述由外层 page.tsx 根据 NODE_META 渲染，这里不重复 */}

      {/* 核心 radio：返回变量 / 返回文本 */}
      <div className={styles.modeRow}>
        <button
          className={`${styles.modeBtn} ${data.mode === "variables" ? styles.modeBtnActive : ""}`}
          onClick={() => setMode("variables")}
        >
          <span className={styles.modeDot} />
          <span>返回变量</span>
        </button>
        <button
          className={`${styles.modeBtn} ${data.mode === "text" ? styles.modeBtnActive : ""}`}
          onClick={() => setMode("text")}
        >
          {data.mode === "text" ? <span className={styles.modeRadio} /> : <span className={styles.modeDot} />}
          <span>返回文本</span>
        </button>
      </div>

      {/* ============================ 输出变量（variables 模式） ============================ */}
      {data.mode === "variables" && (
        <div className={styles.card}>
          <header className={styles.cardHead} onClick={() => setOutputsOpen((v) => !v)}>
            <ChevronDown size={12} className={`${styles.chev} ${outputsOpen ? "" : styles.chevClosed}`} />
            <span className={styles.cardLabel}>输出变量</span>
            <button
              className={styles.addBtn}
              onClick={(e) => {
                e.stopPropagation();
                addOutput();
              }}
              aria-label="添加输出变量"
            >
              <Plus size={12} />
            </button>
          </header>
          {outputsOpen && (
            <div className={styles.outputsBody}>
              {data.outputs.map((o, i) => (
                <div key={i} className={styles.outputRow}>
                  <input
                    className={styles.outputName}
                    placeholder="变量名"
                    value={o.name}
                    onChange={(e) => updateOutput(i, { name: e.target.value })}
                  />
                  <div className={styles.outputValueWrap}>
                    <span className={styles.varTypeIcon}>str</span>
                    <div className={styles.outputValueInner}>
                      <input
                        className={styles.outputValue}
                        placeholder="引用上游节点输出（待接入选择器）"
                        value={o.ref}
                        onChange={(e) => updateOutput(i, { ref: e.target.value })}
                      />
                    </div>
                    <button className={styles.removeBtn} onClick={() => removeOutput(i)} aria-label="删除输出变量">
                      <Trash2 size={10} />
                    </button>
                  </div>
                </div>
              ))}
              {data.outputs.length === 0 && (
                <button className={styles.emptyAdd} onClick={addOutput}>
                  <Plus size={12} /> 添加输出变量
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ============================ 回答内容（text 模式） ============================ */}
      {data.mode === "text" && (
        <>
          {/* 默认输出变量（text 模式下固定一个变量名 "output"，用户可改名） */}
          <div className={styles.card}>
            <header className={styles.cardHead} onClick={() => setOutputsOpen((v) => !v)}>
              <ChevronDown size={12} className={`${styles.chev} ${outputsOpen ? "" : styles.chevClosed}`} />
              <span className={styles.cardLabel}>输出变量</span>
            </header>
            {outputsOpen && (
              <div className={styles.outputsBody}>
                {data.outputs.map((o, i) => (
                  <div key={i} className={styles.outputRow}>
                    <input
                      className={styles.outputName}
                      placeholder="变量名"
                      value={o.name}
                      onChange={(e) => updateOutput(i, { name: e.target.value })}
                    />
                    <div className={styles.outputValueWrap}>
                      <span className={styles.varTypeIcon}>str</span>
                      <div className={styles.outputValueInner}>
                        <input
                          className={styles.outputValue}
                          placeholder="引用上游节点输出"
                          value={o.ref}
                          onChange={(e) => updateOutput(i, { ref: e.target.value })}
                        />
                      </div>
                      <button className={styles.removeBtn} onClick={() => removeOutput(i)} aria-label="删除输出变量">
                        <Trash2 size={10} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 回答内容卡片（含流式输出开关） */}
          <div className={styles.card}>
            <header className={styles.cardHead} onClick={() => setTextOpen((v) => !v)}>
              <ChevronDown size={12} className={`${styles.chev} ${textOpen ? "" : styles.chevClosed}`} />
              <span className={styles.cardLabel}>回答内容</span>
              <div className={styles.headRight}>
                <span className={styles.switchLabel}>流式输出</span>
                <button
                  className={`${styles.switch} ${data.streaming ? styles.switchOn : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setStreaming(!data.streaming);
                  }}
                  aria-label="流式输出开关"
                  aria-pressed={data.streaming}
                >
                  <span className={styles.switchKnob} />
                </button>
              </div>
            </header>
            {textOpen && (
              <div className={styles.textBody}>
                <textarea
                  className={styles.textarea}
                  placeholder="支持 {{变量名}} 引用上游节点输出，如 {{output}}"
                  value={data.text}
                  onChange={(e) => setText(e.target.value)}
                  rows={4}
                />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
