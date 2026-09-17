"use client";

import { useContext, useEffect, useRef, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { CheckCircle2, Sparkles, X } from "lucide-react";
import { toast } from "@/hooks/useToast";
import { EnterEditContext } from "../../../../editContext";
import { EditableNodeTitle } from "../../../EditableNodeTitle";
import { KIND_META } from "../../../../types/kindMeta";
import type { CardNodeData } from "../../../../types/nodes";
import sharedStyles from "../../index.module.scss";
import localStyles from "./index.module.scss";

const styles = { ...sharedStyles, ...localStyles };

/**
 * 渲染卡片节点通用的 Markdown 文本编辑器。
 *
 * @param props - 编辑器初始内容、视觉强调色与保存/取消回调。
 * @returns 卡片节点编辑器。
 */
function NodeEditor({
  categoryLabel,
  initialTitle,
  initialText,
  onSave,
  onCancel,
}: {
  categoryLabel: string;
  initialTitle: string;
  initialText: string;
  onSave: (title: string, text: string) => void;
  onCancel: () => void;
}) {
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const [title, setTitle] = useState(initialTitle);
  const [text, setText] = useState(initialText);

  useEffect(() => {
    requestAnimationFrame(() => taRef.current?.focus());
  }, []);

  const wrapLine = (prefix: string) => {
    const ta = taRef.current;
    if (!ta) return;
    const { selectionStart, selectionEnd, value } = ta;
    const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
    const nv = value.slice(0, lineStart) + prefix + value.slice(lineStart);
    setText(nv);
    requestAnimationFrame(() => {
      ta.selectionStart = selectionStart + prefix.length;
      ta.selectionEnd = selectionEnd + prefix.length;
      ta.focus();
    });
  };
  const wrapSel = (before: string, after?: string) => {
    const ta = taRef.current;
    if (!ta) return;
    const { selectionStart, selectionEnd, value } = ta;
    const sel = value.slice(selectionStart, selectionEnd);
    const nv = value.slice(0, selectionStart) + before + sel + (after ?? "") + value.slice(selectionEnd);
    setText(nv);
    requestAnimationFrame(() => {
      ta.selectionStart = selectionStart + before.length;
      ta.selectionEnd = selectionEnd + before.length;
      ta.focus();
    });
  };
  const copyAll = () => {
    void navigator.clipboard?.writeText(text);
    toast("已复制到剪贴板", "success");
  };

  const FB = ({
    label,
    title: t,
    onClick,
    bold,
    italic,
    strike,
  }: {
    label: string;
    title?: string;
    onClick: () => void;
    bold?: boolean;
    italic?: boolean;
    strike?: boolean;
  }) => (
    <button
      className={styles.formatBtn}
      title={t ?? label}
      onClick={onClick}
      style={{
        fontWeight: bold ? 700 : 500,
        fontStyle: italic ? "italic" : "normal",
        textDecoration: strike ? "line-through" : "none",
      }}
    >
      {label}
    </button>
  );

  return (
    <div data-canvas-node-surface className={styles.nodeEditor} onDoubleClick={(e) => e.stopPropagation()}>
      {/* 头部 */}
      <div className={styles.nodeEditorHead}>
        <span className={styles.cardCategory}>{categoryLabel}</span>
        <input
          className={styles.nodeEditorTitleInput}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") taRef.current?.focus();
            e.stopPropagation();
          }}
          placeholder="标题"
          aria-label="节点标题"
        />
        {/* TODO(canvas-card): 接入卡片内容重写接口后启用该操作。 */}
        <button className={styles.nodeEditorBtn} title="AI 重写（即将上线）" disabled>
          <Sparkles size={12} />
        </button>
        <button className={styles.nodeEditorBtn} title="保存（⌘+Enter）" onClick={() => onSave(title, text)}>
          <CheckCircle2 size={12} />
        </button>
        <button className={styles.nodeEditorBtn} title="取消（ESC）" onClick={onCancel}>
          <X size={12} />
        </button>
      </div>

      {/* 格式化工具条 */}
      <div className={styles.formatBar}>
        <FB label="H1" onClick={() => wrapLine("# ")} />
        <FB label="H2" onClick={() => wrapLine("## ")} />
        <FB label="H3" onClick={() => wrapLine("### ")} />
        <span className={styles.formatSep} />
        <FB label="❝" title="引用" onClick={() => wrapLine("> ")} />
        <FB label="B" title="加粗" bold onClick={() => wrapSel("**", "**")} />
        <FB label="I" title="斜体" italic onClick={() => wrapSel("*", "*")} />
        <span className={styles.formatSep} />
        <FB label="1." title="有序列表" onClick={() => wrapLine("1. ")} />
        <FB label="•" title="无序列表" onClick={() => wrapLine("- ")} />
        <FB label="S" title="删除线" strike onClick={() => wrapSel("~~", "~~")} />
        <span className={styles.formatSep} />
        <FB label="⧉" title="复制全文" onClick={copyAll} />
      </div>

      {/* 编辑区 */}
      <textarea
        ref={taRef}
        className={styles.nodeEditorArea}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onCancel();
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onSave(title, text);
          e.stopPropagation();
        }}
        placeholder="输入内容…（Markdown 语法，⌘+Enter 保存，ESC 取消）"
      />

      <div className={styles.nodeEditorFoot}>
        <span>{text.length} 字 · 双击节点进入编辑</span>
      </div>
    </div>
  );
}

/**
 * 渲染结构化卡片节点，并在双击后切换为通用节点编辑器。
 *
 * @param props - React Flow 注入的节点属性。
 * @returns 卡片节点浏览态或编辑态组件。
 */
export function CardNode({ data, id }: NodeProps) {
  const edit = useContext(EnterEditContext);
  const d = data as unknown as CardNodeData;
  const meta = KIND_META[d.kind];

  if (edit.editingId === id) {
    return (
      <NodeEditor
        categoryLabel={d.category || meta.badge}
        initialTitle={d.title}
        initialText={(d.fields ?? []).map((f) => `${f.label}：${f.value}`).join("\n")}
        onSave={(title, text) => edit.saveEdit(id, title, text)}
        onCancel={edit.exitEdit}
      />
    );
  }

  return (
    <div data-canvas-node-surface className={styles.card} onDoubleClick={() => edit.enterEdit(id)}>
      <Handle type="target" position={Position.Left} className={styles.cardHandle} />
      <div className={styles.cardHead}>
        <span className={styles.cardCategory}>{d.category || meta.badge}</span>
        <EditableNodeTitle nodeId={id} value={d.title} fallback="节点" className={styles.cardType} />
      </div>
      {d.fields?.[0]?.label !== "_title" && (
        <div className={styles.cardFields}>
          {(d.fields ?? []).slice(0, 6).map((f, i) => (
            <div key={i} className={styles.cardField}>
              <span className={styles.cardFieldLabel}>{f.label}</span>
              <span className={styles.cardFieldValue}>{f.value}</span>
            </div>
          ))}
        </div>
      )}
      <Handle type="source" position={Position.Right} className={styles.cardHandle} />
    </div>
  );
}
