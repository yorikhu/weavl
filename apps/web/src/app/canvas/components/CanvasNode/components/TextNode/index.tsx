"use client";

import { useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  Handle,
  NodeResizeControl,
  Position,
  useReactFlow,
  useStore,
  type NodeProps,
  type ResizeParams,
} from "@xyflow/react";
import { AlignLeft, FilePenLine, Type as TypeIcon } from "lucide-react";
import { toast } from "@/hooks/useToast";
import { jsonBody, studioApi } from "@/lib/studioApi";
import { NodePromptPanel } from "../../../NodePromptPanel";
import { EnterEditContext } from "../../../../editContext";
import { EditableNodeTitle } from "../../../EditableNodeTitle";
import type { TextNodeData } from "../../../../types/nodes";
import sharedStyles from "../../index.module.scss";
import localStyles from "./index.module.scss";

const styles = { ...sharedStyles, ...localStyles };

/** 文本节点右下角缩放柄：悬停时显示，并将拖拽尺寸实时写回节点数据。 */
function TextNodeResizeHandle({ id }: { id: string }) {
  const { setNodes } = useReactFlow();

  const resize = useCallback(
    (_event: unknown, params: ResizeParams) => {
      setNodes((nodes) =>
        nodes.map((node) =>
          node.id === id
            ? {
                ...node,
                data: {
                  ...(node.data as Record<string, unknown>),
                  width: Math.round(params.width),
                  height: Math.round(params.height),
                },
              }
            : node,
        ),
      );
    },
    [id, setNodes],
  );

  return (
    <NodeResizeControl
      nodeId={id}
      position="bottom-right"
      minWidth={300}
      minHeight={120}
      maxWidth={720}
      maxHeight={560}
      className={`${styles.textNodeResizeControl} nodrag nopan`}
      onResize={resize}
    />
  );
}

/**
 * 渲染 React Flow 文本节点，并根据编辑上下文切换展示状态。
 *
 * @param props - React Flow 注入的节点属性。
 */
export function TextNode({ data, id }: NodeProps) {
  const edit = useContext(EnterEditContext);
  const d = data as unknown as TextNodeData;
  const editing = edit.editingId === id;
  const hasText = Boolean(d.text?.trim());
  const isManualNode = d.creationMode === "manual";

  if (editing) {
    return edit.editingMode === "manual" ? <TextNodeEditor id={id} data={d} /> : <EmptyTextNodeEditor id={id} data={d} />;
  }

  return (
    <div className={styles.textNodeEditorWrap}>
      <TextNodeResizeHandle id={id} />
      <div className={styles.imageNodeTitleAbove}>
        <TypeIcon size={12} />
        <EditableNodeTitle nodeId={id} value={d.title} fallback="文本" />
      </div>
      <div
        data-canvas-node-surface
        className={styles.textNode}
        style={
          d.width || d.height
            ? { width: d.width ? `${d.width}px` : undefined, height: d.height ? `${d.height}px` : undefined }
            : undefined
        }
        onClick={(event) => {
          if (!hasText && !isManualNode && !(event.target as Element).closest(".react-flow__handle")) {
            edit.enterEdit(id, "generate");
          }
        }}
        onDoubleClick={(event) => {
          if ((hasText || isManualNode) && !(event.target as Element).closest(".react-flow__handle")) {
            edit.enterEdit(id, "manual");
          }
        }}
      >
        <Handle type="target" position={Position.Left} className={styles.cardHandle} />
        {hasText || isManualNode ? (
          <div
            className={styles.textNodeBody}
            style={
              d.height
                ? { maxHeight: "none", overflow: "hidden auto", WebkitLineClamp: "unset", display: "block" }
                : undefined
            }
          >
            {d.text}
          </div>
        ) : (
          <>
            <div className={styles.textEmptyPlaceholder} aria-hidden="true">
              <AlignLeft size={30} strokeWidth={1.7} />
            </div>
            <div className={`${styles.textTry} nodrag nopan`}>
              <span className={styles.textTryLabel}>尝试：</span>
              <button
                className={styles.textGenerateButton}
                type="button"
                onPointerDown={(event) => event.stopPropagation()}
                onDoubleClick={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  edit.enterEdit(id, "manual");
                }}
              >
                <FilePenLine size={9} strokeWidth={1.7} />
                自己编写内容
              </button>
            </div>
          </>
        )}
        <Handle type="source" position={Position.Right} className={styles.cardHandle} />
      </div>
    </div>
  );
}

function EmptyTextNodeEditor({ id, data }: { id: string; data: TextNodeData }) {
  const edit = useContext(EnterEditContext);
  return (
    <div data-canvas-text-editor className={`${styles.textNodeEditorWrap} nowheel`}>
      <TextNodeResizeHandle id={id} />
      <div className={styles.imageNodeTitleAbove}>
        <TypeIcon size={12} />
        <span>{edit.buffer.title || data.title || "文本"}</span>
      </div>
      <div
        data-canvas-node-surface
        className={styles.textNode}
        style={
          data.width || data.height
            ? {
                width: data.width ? `${data.width}px` : undefined,
                height: data.height ? `${data.height}px` : undefined,
              }
            : undefined
        }
      >
        <Handle type="target" position={Position.Left} className={styles.cardHandle} />
        <div className={styles.textEmptyPlaceholder} aria-hidden="true">
          <AlignLeft size={30} strokeWidth={1.7} />
        </div>
        <div className={styles.textTry}>
          <span className={styles.textTryLabel}>尝试：</span>
          <button
            type="button"
            className={`${styles.textGenerateButton} nodrag nopan`}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => edit.enterEdit(id, "manual")}
          >
            <FilePenLine size={9} strokeWidth={1.7} />
            自己编写内容
          </button>
        </div>
        <Handle type="source" position={Position.Right} className={styles.cardHandle} />
      </div>
    </div>
  );
}

interface TextModelOption {
  id: string;
  label: string;
  configured: boolean;
}

const FALLBACK_TEXT_MODELS: TextModelOption[] = [
  { id: "weavl-text", label: "Weavl Text", configured: false },
  { id: "volcengine-text", label: "豆包", configured: false },
  { id: "aliyun-text", label: "通义千问", configured: false },
  { id: "zenmux-text", label: "ZenMux Text", configured: false },
];

/** 文本节点生成态使用与图片、视频一致的节点下方提示词面板。 */
export function TextEditPanel() {
  const edit = useContext(EnterEditContext);
  const editingId = edit.editingId;
  const node = useStore((state) => (editingId ? (state.nodes.find((item) => item.id === editingId) ?? null) : null));
  const isText =
    (node?.data as Record<string, unknown> | undefined)?.nodeKind === "text" && edit.editingMode === "generate";
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("weavl-text");
  const [models, setModels] = useState(FALLBACK_TEXT_MODELS);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isText) return;
    void studioApi<TextModelOption[]>("/studio/generations/text/models")
      .then(setModels)
      .catch(() => setModels(FALLBACK_TEXT_MODELS));
  }, [isText]);

  const generate = useCallback(async () => {
    if (!editingId || !prompt.trim() || busy) return;
    setBusy(true);
    try {
      const result = await studioApi<{ content: string; mode: "live" | "mock" }>("/studio/generations/text", {
        method: "POST",
        body: jsonBody({ model, prompt }),
      });
      edit.saveEdit(editingId, edit.buffer.title || "文本", result.content);
      setPrompt("");
      toast(result.mode === "live" ? "文案已生成" : "演示文案已生成", "success");
    } catch (cause) {
      toast((cause as Error).message || "文本生成失败");
    } finally {
      setBusy(false);
    }
  }, [busy, edit, editingId, model, prompt]);

  if (!editingId || !isText) return null;
  return (
    <NodePromptPanel
      nodeId={editingId}
      prompt={prompt}
      placeholder="写下内容主题、受众、语气与交付形式…"
      model={model}
      models={models.map((item) => ({
        id: item.id,
        label: item.label,
        detail: item.configured ? undefined : "演示",
      }))}
      modelMenuLabel="文本模型"
      cost={6}
      busy={busy}
      rows={4}
      onPromptChange={setPrompt}
      onModelChange={setModel}
      onSubmit={() => void generate()}
      onEscape={edit.exitEdit}
    />
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
function TextNodeEditor({ id, data }: { id: string; data: TextNodeData }) {
  const edit = useContext(EnterEditContext);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const initialTextRef = useRef(edit.buffer.text);
  const [isEmpty, setIsEmpty] = useState(!edit.buffer.text);

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

  /** 删除全部文字后浏览器可能保留 br/div，清空这些占位节点以恢复 CSS placeholder。 */
  const normalizeEmptyEditor = useCallback(() => {
    const editor = editorRef.current;
    if (editor && editor.textContent === "") {
      editor.replaceChildren();
    }
    setIsEmpty(!editor?.textContent);
  }, []);

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
    <div data-canvas-text-editor className={`${styles.textNodeEditorWrap} nowheel`}>
      <TextNodeResizeHandle id={id} />
      <div className={styles.imageNodeTitleAbove}>
        <TypeIcon size={12} />
        <span>{edit.buffer.title || data.title || "文本"}</span>
      </div>
      {/* 编辑卡片需要 overflow:hidden 才能原生 resize，连接点放到外层以免被裁剪。 */}
      <Handle type="target" position={Position.Left} className={styles.cardHandle} />
      <div
        data-canvas-node-surface
        ref={containerRef}
        className={`${styles.textNode} ${styles.textNodeEditing} nodrag nopan`}
        style={styleSize}
      >
        <div
          ref={editorRef}
          className={`${styles.textNodeBodyEdit} nodrag`}
          contentEditable
          data-empty={isEmpty}
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
            normalizeEmptyEditor();
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
      </div>
      <Handle type="source" position={Position.Right} className={styles.cardHandle} />
    </div>
  );
}
