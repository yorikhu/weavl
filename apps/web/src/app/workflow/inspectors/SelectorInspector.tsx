"use client";

import { ChevronDown, GripVertical, Plus, Trash2 } from "lucide-react";
import styles from "./SelectorInspector.module.scss";

/* ============================== 数据结构 ============================== */
export interface SelectorCondition {
  id: string;
  /** 操作符 */
  op: Op;
  /** 左值：变量引用或字面量 */
  left: string;
  /** 右值 */
  right: string;
  /** 左值类型（变量类型 chip 用，default "str"） */
  leftType: "str" | "int" | "float" | "bool";
}

export type Op = "==" | "!=" | ">" | ">=" | "<" | "<=" | "contains" | "not-contains" | "is-empty" | "is-not-empty";

export const OPS: Array<{ value: Op; label: string; compact: string }> = [
  { value: "==", label: "等于", compact: "=" },
  { value: "!=", label: "不等于", compact: "≠" },
  { value: ">", label: "大于", compact: ">" },
  { value: ">=", label: "大于等于", compact: "≥" },
  { value: "<", label: "小于", compact: "<" },
  { value: "<=", label: "小于等于", compact: "≤" },
  { value: "contains", label: "包含", compact: "包含" },
  { value: "not-contains", label: "不包含", compact: "不包含" },
  { value: "is-empty", label: "为空", compact: "为空" },
  { value: "is-not-empty", label: "不为空", compact: "不为空" },
];

/** "如果" 分组：每个分组是一组并列条件（logic 决定组内 AND/OR） */
export interface SelectorBranch {
  id: string;
  /** 组内条件间的逻辑：and = 且（全满足），or = 或（任一满足） */
  logic: "and" | "or";
  conditions: SelectorCondition[];
}

export interface SelectorConfig {
  description?: string;
  branches: SelectorBranch[];
}

/**
 * 补齐选择器节点配置的默认字段。
 *
 * @param c - 组件属性。
 * @returns 可供检查器直接使用的完整选择器配置。
 */
export function normalizeSelectorConfig(c: Partial<SelectorConfig>): SelectorConfig {
  return {
    description: c.description,
    branches: c.branches ?? [
      {
        id: "b1",
        logic: "and",
        conditions: [{ id: "c1", op: "==", left: "", right: "", leftType: "str" }],
      },
    ],
  };
}

/* ============================== 组件 ============================== */
interface Props {
  config: SelectorConfig;
  onChange: (next: SelectorConfig) => void;
}

const TYPE_ICONS: Record<SelectorCondition["leftType"], string> = {
  str: "T",
  int: "#",
  float: "#",
  bool: "B",
};

/**
 * 渲染选择器节点配置面板。
 *
 * @param props - 组件属性。
 * @returns 选择器节点检查器。
 */
export function SelectorInspector({ config, onChange }: Props) {
  const update = <K extends keyof SelectorConfig>(k: K, v: SelectorConfig[K]) => onChange({ ...config, [k]: v });

  const addBranch = () => {
    update("branches", [
      ...config.branches,
      {
        id: `b${Date.now().toString(36)}`,
        logic: "and",
        conditions: [{ id: `c${Date.now().toString(36)}`, op: "==", left: "", right: "", leftType: "str" }],
      },
    ]);
  };

  const removeBranch = (bIndex: number) =>
    update(
      "branches",
      config.branches.filter((_, i) => i !== bIndex),
    );

  const addCond = (bIndex: number) => {
    const next = [...config.branches];
    const target = next[bIndex]!;
    next[bIndex] = {
      ...target,
      conditions: [
        ...target.conditions,
        { id: `c${Date.now().toString(36)}`, op: "==", left: "", right: "", leftType: "str" },
      ],
    };
    update("branches", next);
  };

  const removeCond = (bIndex: number, cIndex: number) => {
    const next = [...config.branches];
    const target = next[bIndex]!;
    next[bIndex] = {
      ...target,
      conditions: target.conditions.filter((_, i) => i !== cIndex),
    };
    update("branches", next);
  };

  const updateCond = (bIndex: number, cIndex: number, patch: Partial<SelectorCondition>) => {
    const next = [...config.branches];
    const cs = [...next[bIndex]!.conditions];
    cs[cIndex] = { ...cs[cIndex]!, ...patch } as SelectorCondition;
    next[bIndex] = { ...next[bIndex]!, conditions: cs };
    update("branches", next);
  };

  const updateBranchLogic = (bIndex: number, logic: "and" | "or") => {
    const next = [...config.branches];
    next[bIndex] = { ...next[bIndex]!, logic };
    update("branches", next);
  };

  return (
    <div className={styles.inspectorBody}>
      {/* ============== 条件分支列表 ============== */}
      <div className={styles.branchList}>
        {config.branches.map((branch, bIndex) => (
          <div key={branch.id} className={styles.ifGroup}>
            {/* 分组头部：拖拽手柄 + 标签（如果/否则如果）+ 优先级 tag + 删除 */}
            <header className={styles.ifGroupHead}>
              <div className={styles.ifGroupLeft}>
                <GripVertical size={12} className={styles.gripIcon} />
                <span className={styles.ifGroupTitle}>{bIndex === 0 ? "如果" : "否则如果"}</span>
                <span className={styles.priorityTag}>优先级 {bIndex + 1}</span>
              </div>
              <button
                className={styles.ifGroupDelete}
                type="button"
                aria-label="删除分支"
                title="删除分支"
                onClick={() => removeBranch(bIndex)}
              >
                <Trash2 size={11} />
              </button>
            </header>

            <div className={styles.ifGroupBody}>
              {/* 条件行：左侧 L 形连接线 + 且/或 + 操作符 + 左值 + 右值 + 删除 */}
              {branch.conditions.map((c, cIndex) => {
                const isFirst = cIndex === 0;
                const isLast = cIndex === branch.conditions.length - 1;
                const showOpError = !c.op;
                const showLeftError = !c.left.trim();
                const showRightError = !c.right.trim();

                return (
                  <div key={c.id} className={styles.condRow}>
                    {/* 左侧 L 形连接线 + 条件间逻辑 select */}
                    <div className={styles.condRail}>
                      {!isFirst && (
                        <select
                          className={styles.logicSelect}
                          value={branch.logic}
                          onChange={(e) => updateBranchLogic(bIndex, e.target.value as "and" | "or")}
                          aria-label="条件组合方式"
                        >
                          <option value="and">且</option>
                          <option value="or">或</option>
                        </select>
                      )}
                      <div
                        className={`${styles.railLine} ${isFirst ? styles.railLineTopOnly : ""} ${isLast ? styles.railLineBottomOnly : ""}`}
                      />
                    </div>

                    {/* 右侧条件主体：操作符 + 左值 + 右值 + 删除 */}
                    <div className={styles.condBody}>
                      <div className={styles.condField}>
                        <select
                          className={`${styles.opSelect} ${showOpError ? styles.opSelectError : ""}`}
                          value={c.op}
                          onChange={(e) => updateCond(bIndex, cIndex, { op: e.target.value as Op })}
                          aria-label="操作符"
                        >
                          <option value="">请选择</option>
                          {OPS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                        {showOpError && <div className={styles.errorText}>条件不可为空</div>}
                      </div>

                      <div className={styles.condField}>
                        <div className={styles.leftInputWrap}>
                          <span className={styles.typeIcon} title={c.leftType} aria-hidden="true">
                            {TYPE_ICONS[c.leftType]}
                          </span>
                          <input
                            className={`${styles.leftInput} ${showLeftError ? styles.leftInputError : ""}`}
                            placeholder="请选择"
                            value={c.left}
                            onChange={(e) => updateCond(bIndex, cIndex, { left: e.target.value })}
                          />
                          <ChevronDown size={12} className={styles.typeArrow} />
                        </div>
                        {showLeftError && <div className={styles.errorText}>变量值不可为空</div>}
                      </div>

                      <div className={styles.condField}>
                        <div className={styles.rightInputWrap}>
                          <input
                            className={`${styles.rightInput} ${showRightError ? styles.rightInputError : ""}`}
                            placeholder="输入或引用参数值"
                            value={c.right}
                            onChange={(e) => updateCond(bIndex, cIndex, { right: e.target.value })}
                          />
                          <button className={styles.applyBtn} type="button" title="选择变量">
                            <span className={styles.applyIcon}>⊕</span>
                          </button>
                        </div>
                        {showRightError && <div className={styles.errorText}>变量值不可为空</div>}
                      </div>

                      {/* 行内删除按钮 */}
                      <button
                        className={styles.rowDelete}
                        type="button"
                        aria-label="删除条件"
                        title="删除条件"
                        onClick={() => removeCond(bIndex, cIndex)}
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* 底部 + 新增 按钮（左缩进 48px 模拟 L 形线位置） */}
              <button className={styles.condAddBtn} type="button" title="新增条件" onClick={() => addCond(bIndex)}>
                <Plus size={11} /> 新增
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ============== 底部"否则"固定分组（不可删） ============== */}
      <div className={styles.elseGroup}>
        <span className={styles.elseTitle}>否则</span>
      </div>

      {/* ============== 添加分支按钮 ============== */}
      <div className={styles.addBranchWrap}>
        <button className={styles.addBranchBtn} type="button" title="添加分支" onClick={addBranch}>
          <Plus size={12} /> 添加分支
        </button>
      </div>
    </div>
  );
}
