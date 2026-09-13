"use client";

import { useCallback, useContext, useEffect, useRef } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Type as TypeIcon } from "lucide-react";
import { EnterEditContext } from "../../../../editContext";
import type { TextNodeData } from "../../../../types/nodes";
import sharedStyles from "../../index.module.scss";
import localStyles from "./index.module.scss";

const styles = { ...sharedStyles, ...localStyles };

/**
 * 渲染 React Flow 文本节点，并根据编辑上下文切换展示状态。
 *
 * @param props - React Flow 注入的节点属性。
 */
export function TextNode({ data, id }: NodeProps) {
  const edit = useContext(EnterEditContext);
  const d = data as unknown as TextNodeData;
  const editing = edit.editingId === id;

  if (editing) {
    return <TextNodeEditor data={d} />;
  }

  return (
    <div
      data-canvas-node-surface
      className={styles.textNode}
      style={
        d.width || d.height
          ? { width: d.width ? `${d.width}px` : undefined, height: d.height ? `${d.height}px` : undefined }
          : undefined
      }
      onDoubleClick={() => edit.enterEdit(id)}
    >
      <Handle type="target" position={Position.Left} className={styles.cardHandle} />
      <div className={styles.imageNodeTitleAbove}>
        <TypeIcon size={12} />
        <span>{d.title || "文本"}</span>
      </div>
      <div
        className={styles.textNodeBody}
        style={
          d.height
            ? { maxHeight: "none", overflow: "hidden auto", WebkitLineClamp: "unset", display: "block" }
            : undefined
        }
      >
        {d.text || "输入文本内容…（双击编辑）"}
      </div>
      <Handle type="source" position={Position.Right} className={styles.cardHandle} />
    </div>
  );
}

/**
 * 渲染基于 contentEditable 的文本节点编辑器。
 *
 * @remarks
 * 文本由 DOM 自行维护，并在提交时同步到编辑缓冲区，避免输入期间因 React
 * 重渲染导致光标跳转；IME 组合输入期间不会同步缓冲区。
 *
 * @param props - 当前文本节点数据。
 */
function TextNodeEditor({ data }: { data: TextNodeData }) {
  const edit = useContext(EnterEditContext);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const initialTextRef = useRef(edit.buffer.text);

  /** 挂载：buffer.text 写一次到 DOM，光标放到末尾 */
  useEffect(() => {
    if (!editorRef.current) return;
    if (editorRef.current.innerText !== initialTextRef.current) {
      editorRef.current.innerText = initialTextRef.current;
    }
    editorRef.current.focus();
    const range = document.createRange();
    range.selectNodeContents(editorRef.current);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }, []); // 仅挂载一次

  /** 把 DOM 当前文本同步进 buffer（仅在不在 IME composition 时调用） */
  const syncBufferFromDOM = useCallback(() => {
    if (!editorRef.current) return;
    if (edit.composingRef.current) return;
    const text = editorRef.current.innerText || "";
    edit.setBuffer({ title: edit.buffer.title, text });
  }, [edit]);

  /** 卸载：清理 ref */
  useEffect(() => {
    const editor = editorRef.current;
    edit.editorElRef.current = editor;
    return () => {
      if (edit.editorElRef.current === editor) {
        edit.editorElRef.current = null;
      }
    };
  }, [edit]);

  const styleSize =
    data.width || data.height
      ? { width: data.width ? `${data.width}px` : undefined, height: data.height ? `${data.height}px` : undefined }
      : undefined;

  return (
    <div
      data-canvas-node-surface
      ref={containerRef}
      className={`${styles.textNode} ${styles.textNodeEditing} nowheel`}
      style={styleSize}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <Handle type="target" position={Position.Left} className={styles.cardHandle} />
      <div className={styles.imageNodeTitleAbove}>
        <TypeIcon size={12} />
        <input
          className={`${styles.imageNodeTitleInput} nodrag`}
          value={edit.buffer.title}
          onChange={(e) => {
            edit.setBuffer({ title: e.target.value, text: edit.buffer.text });
          }}
          onKeyDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          placeholder="文本节点"
        />
      </div>
      <div
        ref={editorRef}
        className={`${styles.textNodeBodyEdit} nodrag`}
        contentEditable
        suppressContentEditableWarning
        spellCheck={false}
        /** 不在这里放 {text} children —— DOM 自己维护，避免 React 重置光标 */
        onCompositionStart={() => {
          edit.composingRef.current = true;
        }}
        onCompositionEnd={() => {
          edit.composingRef.current = false;
          syncBufferFromDOM();
        }}
        onInput={() => {
          /** 不在每次按键时 setBuffer，避免 React 重置光标；
          compositionEnd / blur / commit 时再统一同步。 */
        }}
        onBlur={() => {
          syncBufferFromDOM();
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            edit.exitEdit();
            return;
          }
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            syncBufferFromDOM();
            edit.commitEdit();
            return;
          }
          e.stopPropagation();
        }}
      />
      <Handle type="source" position={Position.Right} className={styles.cardHandle} />
    </div>
  );
}
