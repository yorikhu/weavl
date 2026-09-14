"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, type KeyboardEvent } from "react";
import styles from "./index.module.scss";

export type ComposerToken = { type: "asset" | "model" | "skill"; id: string; label: string; instanceId?: string };
export type InlineComposerHandle = {
  insertToken: (token: ComposerToken, focus?: boolean) => void;
  focus: () => void;
};

type Props = {
  value: string;
  onValueChange: (value: string) => void;
  onTokenRemove: (token: ComposerToken) => void;
  onSubmit: () => void;
  placeholder: string;
};

const iconPaths: Record<ComposerToken["type"], string> = {
  asset: "M21.44 11.05 12.25 20.24a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.82-2.82l8.49-8.49",
  model: "m12 2 9 5-9 5-9-5 9-5ZM3 7v10l9 5 9-5V7M12 12v10",
  skill: "M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4L15 12l-3-3 2.7-2.7Z",
};

function icon(path: string) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "13");
  svg.setAttribute("height", "13");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.8");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  const shape = document.createElementNS("http://www.w3.org/2000/svg", "path");
  shape.setAttribute("d", path);
  svg.append(shape);
  return svg;
}

function tokenFromNode(node: Element): ComposerToken {
  return {
    type: node.getAttribute("data-token-type") as ComposerToken["type"],
    id: node.getAttribute("data-token-id") || "",
    label: node.getAttribute("data-token-label") || "",
    instanceId: node.getAttribute("data-token-instance") || "",
  };
}

function removeChip(node: Element) {
  const next = node.nextSibling;
  if (next?.nodeType === Node.TEXT_NODE && next.textContent?.startsWith("\u200b")) {
    next.textContent = next.textContent.slice(1);
    if (!next.textContent) next.parentNode?.removeChild(next);
  }
  node.remove();
}

function readText(root: HTMLElement) {
  const clone = root.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("[data-token-type]").forEach((node) => node.remove());
  clone.querySelectorAll("br").forEach((node) => node.replaceWith(document.createTextNode("\n")));
  return (clone.textContent || "").replaceAll("\u200b", "");
}

export const InlineComposer = forwardRef<InlineComposerHandle, Props>(function InlineComposer(
  { value, onValueChange, onTokenRemove, onSubmit, placeholder },
  ref,
) {
  const editorRef = useRef<HTMLDivElement>(null);
  const rangeRef = useRef<Range | null>(null);
  const knownTokensRef = useRef<ComposerToken[]>([]);
  const nextTokenInstanceRef = useRef(0);
  const callbacksRef = useRef({ onValueChange, onTokenRemove, onSubmit });
  callbacksRef.current = { onValueChange, onTokenRemove, onSubmit };

  function saveRange() {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (editor && selection?.rangeCount && editor.contains(selection.anchorNode)) {
      rangeRef.current = selection.getRangeAt(0).cloneRange();
    }
  }

  function sync(preserveRange = false) {
    const editor = editorRef.current;
    if (!editor) return;
    const tokens = [...editor.querySelectorAll("[data-token-type]")].map(tokenFromNode);
    for (const token of knownTokensRef.current) {
      if (!tokens.some((item) => item.instanceId === token.instanceId)) {
        callbacksRef.current.onTokenRemove(token);
      }
    }
    knownTokensRef.current = tokens;
    const text = readText(editor);
    editor.dataset.empty = text || tokens.length ? "false" : "true";
    callbacksRef.current.onValueChange(text);
    if (!preserveRange) saveRange();
    requestAnimationFrame(() => {
      if (editor.isConnected && editor.contains(document.activeElement)) editor.scrollTop = editor.scrollHeight;
    });
  }

  function caretRange() {
    const editor = editorRef.current!;
    const selection = window.getSelection();
    const editorFocused = document.activeElement === editor || editor.contains(document.activeElement);
    const active = editorFocused && selection?.rangeCount && editor.contains(selection.anchorNode)
      ? selection.getRangeAt(0)
      : null;
    const saved = active || rangeRef.current;
    const range = saved && editor.contains(saved.startContainer) ? saved.cloneRange() : document.createRange();
    if (!saved || !editor.contains(saved.startContainer)) {
      range.selectNodeContents(editor);
      range.collapse(false);
    }
    return range;
  }

  function focusAt(range: Range) {
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    editorRef.current?.focus();
    rangeRef.current = range.cloneRange();
  }

  function insertText(text: string) {
    const range = caretRange();
    range.deleteContents();
    const node = document.createTextNode(text);
    range.insertNode(node);
    range.setStartAfter(node);
    range.collapse(true);
    focusAt(range);
    sync();
  }

  useImperativeHandle(ref, () => ({
    insertToken(token, focus = true) {
      const editor = editorRef.current;
      if (!editor) return;
      const range = caretRange();
      const chip = document.createElement("span");
      chip.className = styles.token || "";
      chip.contentEditable = "false";
      chip.setAttribute("data-token-type", token.type);
      chip.setAttribute("data-token-id", token.id);
      chip.setAttribute("data-token-label", token.label);
      chip.setAttribute("data-token-instance", String(++nextTokenInstanceRef.current));
      chip.append(icon(iconPaths[token.type]));
      const label = document.createElement("span");
      label.className = styles.tokenLabel || "";
      label.textContent = token.label;
      chip.append(label);
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = styles.remove || "";
      remove.setAttribute("aria-label", `移除${token.label}`);
      remove.append(icon("M18 6 6 18M6 6l12 12"));
      remove.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        removeChip(chip);
        sync();
        editor.focus();
      });
      chip.append(remove);
      range.insertNode(chip);
      const spacer = document.createTextNode("\u200b");
      chip.after(spacer);
      range.setStartAfter(spacer);
      range.collapse(true);
      if (focus) focusAt(range);
      else rangeRef.current = range.cloneRange();
      sync(!focus);
    },
    focus() { editorRef.current?.focus(); },
  }));

  useEffect(() => {
    const onSelectionChange = () => saveRange();
    document.addEventListener("selectionchange", onSelectionChange);
    return () => document.removeEventListener("selectionchange", onSelectionChange);
  }, []);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || document.activeElement === editor || readText(editor) === value) return;
    editor.replaceChildren(document.createTextNode(value));
    editor.dataset.empty = value ? "false" : "true";
  }, [value]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Enter" || event.nativeEvent.isComposing || event.keyCode === 229) return;
    event.preventDefault();
    if (event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) {
      document.execCommand("insertLineBreak");
      sync();
    }
    else callbacksRef.current.onSubmit();
  }

  return (
    <div
      ref={editorRef}
      className={styles.editor}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-label="描述你想完成的内容"
      aria-multiline="true"
      data-placeholder={placeholder}
      data-empty="true"
      title="Enter 开始创作；Shift / Ctrl / Command + Enter 换行"
      onInput={() => sync()}
      onKeyDown={onKeyDown}
      onKeyUp={saveRange}
      onMouseUp={saveRange}
      onPaste={(event) => {
        event.preventDefault();
        insertText(event.clipboardData.getData("text/plain"));
      }}
    />
  );
});
