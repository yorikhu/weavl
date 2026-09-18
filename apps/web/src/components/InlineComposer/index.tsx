"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type ClipboardEvent as ReactClipboardEvent,
  type KeyboardEvent,
} from "react";
import styles from "./index.module.scss";

const COMPOSER_CLIPBOARD_TYPE = "application/x-weavl-composer+json";

/** 可插入 InlineComposer 光标位置的结构化标签。 */
export type ComposerToken = {
  type: "asset" | "model" | "skill";
  id: string;
  label: string;
  instanceId?: string;
  previewUrl?: string;
  mediaKind?: "image" | "video";
};

/** 按编辑器中的真实顺序保存文本与结构化标签。 */
export type ComposerPart = { type: "text"; text: string } | { type: "token"; token: ComposerToken };

/** 供父组件插入标签、聚焦或清空编辑器的命令句柄。 */
export type InlineComposerHandle = {
  insertToken: (token: ComposerToken, focus?: boolean, replaceMention?: boolean) => void;
  hasToken: (type: ComposerToken["type"], id: string) => boolean;
  removeToken: (type: ComposerToken["type"], id: string) => void;
  setDocument: (parts: ComposerPart[]) => void;
  focus: () => void;
  clear: () => void;
};

/** InlineComposer 的受控属性。 */
export type InlineComposerProps = {
  value: string;
  onValueChange: (value: string) => void;
  onPartsChange?: (parts: ComposerPart[]) => void;
  onTokenRemove: (token: ComposerToken) => void;
  onTokenRestore?: (token: ComposerToken) => void;
  onSubmit: () => void;
  placeholder: string;
  ariaLabel?: string;
  submitOnEnter?: boolean;
  disabled?: boolean;
  className?: string;
  preventSubmit?: boolean;
  onEscape?: () => void;
  onMentionQueryChange?: (query: string | null) => void;
};

const iconPaths: Record<ComposerToken["type"], string> = {
  asset:
    "M21.44 11.05 12.25 20.24a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.82-2.82l8.49-8.49",
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
    previewUrl: node.getAttribute("data-token-preview") || undefined,
    mediaKind: (node.getAttribute("data-token-media-kind") as ComposerToken["mediaKind"]) || undefined,
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

function isTokenElement(node: Node | null): node is HTMLElement {
  return node instanceof HTMLElement && node.hasAttribute("data-token-type");
}

/** 返回光标删除方向上紧邻的标签，并忽略标签旁用于放置光标的零宽字符。 */
function adjacentToken(range: Range, direction: "backward" | "forward") {
  const container = range.startContainer;
  let candidate: Node | null = null;

  if (container.nodeType === Node.TEXT_NODE) {
    const text = container.textContent || "";
    const adjacentText = direction === "backward" ? text.slice(0, range.startOffset) : text.slice(range.startOffset);
    if (adjacentText.replaceAll("\u200b", "").length > 0) return null;
    candidate = direction === "backward" ? container.previousSibling : container.nextSibling;
  } else {
    const children = container.childNodes;
    candidate = (direction === "backward" ? children[range.startOffset - 1] : children[range.startOffset]) ?? null;
  }

  while (candidate?.nodeType === Node.TEXT_NODE && !(candidate.textContent || "").replaceAll("\u200b", "")) {
    candidate = direction === "backward" ? candidate.previousSibling : candidate.nextSibling;
  }
  return isTokenElement(candidate) ? candidate : null;
}

/** 找出当前文字选区覆盖到的所有原子标签。 */
function tokensInSelection(editor: HTMLElement, range: Range) {
  if (range.collapsed) return [];
  return [...editor.querySelectorAll<HTMLElement>("[data-token-type]")].filter((token) => {
    try {
      return range.intersectsNode(token);
    } catch {
      return false;
    }
  });
}

function renderTokenSelection(editor: HTMLElement) {
  const selection = window.getSelection();
  const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
  const selected = range && !range.collapsed ? new Set(tokensInSelection(editor, range)) : new Set<HTMLElement>();
  editor.querySelectorAll<HTMLElement>("[data-token-type]").forEach((token) => {
    token.toggleAttribute("data-selected", selected.has(token));
  });
}

function clearTokenSelection(editor: HTMLElement) {
  editor.querySelectorAll<HTMLElement>("[data-token-type][data-selected]").forEach((token) => {
    token.removeAttribute("data-selected");
  });
}

function readText(root: HTMLElement) {
  const clone = root.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("[data-token-type]").forEach((node) => node.remove());
  clone.querySelectorAll("br").forEach((node) => node.replaceWith(document.createTextNode("\n")));
  return (clone.textContent || "").replaceAll("\u200b", "");
}

/** 判断文本是否包含空白、换行和编辑器控制字符之外的可见内容。 */
function hasVisibleText(value: string) {
  return value.replace(/[\s\u200b-\u200d\ufeff]/gu, "").length > 0;
}

/** 判断结构化文档是否包含可见文字或标签。 */
function hasVisibleParts(parts: ComposerPart[]) {
  return parts.some((part) => part.type === "token" || hasVisibleText(part.text));
}

/** 将 contentEditable DOM 转换为不依赖 HTML 的有序文档。 */
function readParts(root: HTMLElement): ComposerPart[] {
  const parts: ComposerPart[] = [];
  const appendText = (text: string) => {
    const normalized = text.replaceAll("\u200b", "");
    if (!normalized) return;
    const previous = parts.at(-1);
    if (previous?.type === "text") previous.text += normalized;
    else parts.push({ type: "text", text: normalized });
  };
  const visit = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      appendText(node.textContent || "");
      return;
    }
    if (!(node instanceof Element)) return;
    if (isTokenElement(node)) {
      parts.push({ type: "token", token: tokenFromNode(node) });
      return;
    }
    if (node.tagName === "BR") {
      appendText("\n");
      return;
    }
    node.childNodes.forEach(visit);
  };
  root.childNodes.forEach(visit);
  return parts;
}

/** 将结构化文档转换为可粘贴到普通应用的可读纯文本。 */
function partsToPlainText(parts: ComposerPart[]) {
  return parts.map((part) => (part.type === "text" ? part.text : part.token.label)).join("");
}

/** 校验来自系统剪贴板的 Weavl 结构化标签数据。 */
function parseClipboardParts(value: string): ComposerPart[] | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return null;
    const parts: ComposerPart[] = [];
    for (const part of parsed) {
      if (!part || typeof part !== "object" || !("type" in part)) return null;
      if (part.type === "text" && "text" in part && typeof part.text === "string") {
        parts.push({ type: "text", text: part.text });
        continue;
      }
      if (part.type !== "token" || !("token" in part) || !part.token || typeof part.token !== "object") {
        return null;
      }
      const token = part.token as Partial<ComposerToken>;
      if (
        !token.type ||
        !["asset", "model", "skill"].includes(token.type) ||
        typeof token.id !== "string" ||
        typeof token.label !== "string"
      ) {
        return null;
      }
      parts.push({
        type: "token",
        token: {
          type: token.type,
          id: token.id,
          label: token.label,
          previewUrl: typeof token.previewUrl === "string" ? token.previewUrl : undefined,
          mediaKind: token.mediaKind === "image" || token.mediaKind === "video" ? token.mediaKind : undefined,
        },
      });
    }
    return parts.length ? parts : null;
  } catch {
    return null;
  }
}

function mentionQueryAtCaret(editor: HTMLElement): string | null {
  const selection = window.getSelection();
  if (!selection?.rangeCount || !editor.contains(selection.anchorNode)) return null;
  const range = selection.getRangeAt(0);
  if (range.startContainer.nodeType !== Node.TEXT_NODE) return null;
  const before = (range.startContainer.textContent || "").slice(0, range.startOffset).replaceAll("\u200b", "");
  return before.match(/@([^@\s]*)$/)?.[1] ?? null;
}

function removeMentionAtCaret(range: Range) {
  if (range.startContainer.nodeType !== Node.TEXT_NODE) return;
  const text = range.startContainer.textContent || "";
  const before = text.slice(0, range.startOffset);
  const match = before.match(/@[^@\s]*$/);
  if (!match || match.index === undefined) return;
  range.setStart(range.startContainer, match.index);
  range.deleteContents();
}

function tokenVisual(token: ComposerToken) {
  if (token.previewUrl && token.mediaKind === "image") {
    const image = document.createElement("img");
    image.className = styles.tokenMedia || "";
    image.src = token.previewUrl;
    image.alt = "";
    return image;
  }
  if (token.previewUrl && token.mediaKind === "video") {
    const video = document.createElement("video");
    video.className = styles.tokenMedia || "";
    video.src = token.previewUrl;
    video.muted = true;
    video.preload = "metadata";
    return video;
  }
  return icon(iconPaths[token.type]);
}

/**
 * 支持文本与资产、模型、Skill 标签混排的富创作输入器。
 * 用于首页和 Agent 等需要在光标处插入标签的场景；普通表单多行输入使用 Form.ComposerTextarea。
 */
export const InlineComposer = forwardRef<InlineComposerHandle, InlineComposerProps>(function InlineComposer(
  {
    value,
    onValueChange,
    onPartsChange,
    onTokenRemove,
    onTokenRestore,
    onSubmit,
    placeholder,
    ariaLabel = "描述你想完成的内容",
    submitOnEnter = true,
    disabled = false,
    className,
    preventSubmit = false,
    onEscape,
    onMentionQueryChange,
  },
  ref,
) {
  const editorRef = useRef<HTMLDivElement>(null);
  const rangeRef = useRef<Range | null>(null);
  const knownTokensRef = useRef<ComposerToken[]>([]);
  const nextTokenInstanceRef = useRef(0);
  const composingRef = useRef(false);
  const callbacksRef = useRef({
    onValueChange,
    onPartsChange,
    onTokenRemove,
    onTokenRestore,
    onSubmit,
    onEscape,
    onMentionQueryChange,
  });
  callbacksRef.current = {
    onValueChange,
    onPartsChange,
    onTokenRemove,
    onTokenRestore,
    onSubmit,
    onEscape,
    onMentionQueryChange,
  };

  function saveRange() {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (editor && selection?.rangeCount && editor.contains(selection.anchorNode)) {
      rangeRef.current = selection.getRangeAt(0).cloneRange();
    }
  }

  function sync(preserveRange = false, notifyRestored = true) {
    const editor = editorRef.current;
    if (!editor) return;
    const tokens = [...editor.querySelectorAll("[data-token-type]")].map(tokenFromNode);
    for (const token of knownTokensRef.current) {
      if (!tokens.some((item) => item.instanceId === token.instanceId)) {
        callbacksRef.current.onTokenRemove(token);
      }
    }
    if (notifyRestored) {
      for (const token of tokens) {
        if (!knownTokensRef.current.some((item) => item.instanceId === token.instanceId)) {
          callbacksRef.current.onTokenRestore?.(token);
        }
      }
    }
    knownTokensRef.current = tokens;
    const text = readText(editor);
    const parts = readParts(editor);
    const empty = !tokens.length && !hasVisibleText(text);
    editor.dataset.empty = empty ? "true" : "false";
    callbacksRef.current.onValueChange(empty ? "" : text);
    callbacksRef.current.onPartsChange?.(empty ? [] : parts);
    if (!preserveRange) saveRange();
    callbacksRef.current.onMentionQueryChange?.(mentionQueryAtCaret(editor));
    requestAnimationFrame(() => {
      if (editor.isConnected && editor.contains(document.activeElement)) editor.scrollTop = editor.scrollHeight;
    });
  }

  function caretRange() {
    const editor = editorRef.current!;
    const selection = window.getSelection();
    const editorFocused = document.activeElement === editor || editor.contains(document.activeElement);
    const active =
      editorFocused && selection?.rangeCount && editor.contains(selection.anchorNode) ? selection.getRangeAt(0) : null;
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

  function removeSelection(range: Range, tokens: HTMLElement[]) {
    const deletionRange = range.cloneRange();
    for (const token of tokens) {
      const tokenRange = document.createRange();
      tokenRange.selectNode(token);
      if (deletionRange.compareBoundaryPoints(Range.START_TO_START, tokenRange) > 0) {
        deletionRange.setStartBefore(token);
      }
      if (deletionRange.compareBoundaryPoints(Range.END_TO_END, tokenRange) < 0) {
        deletionRange.setEndAfter(token);
      }
      const spacer = token.nextSibling;
      if (spacer?.nodeType === Node.TEXT_NODE && spacer.textContent?.startsWith("\u200b")) {
        if (!deletionRange.isPointInRange(spacer, 1)) deletionRange.setEnd(spacer, 1);
      }
    }
    focusAt(deletionRange);
    document.execCommand("delete");
    sync();
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

  function createTokenChip(token: ComposerToken) {
    const chip = document.createElement("span");
    chip.className = styles.token || "";
    chip.contentEditable = "false";
    chip.setAttribute("data-token-type", token.type);
    chip.setAttribute("data-token-id", token.id);
    chip.setAttribute("data-token-label", token.label);
    chip.setAttribute("data-token-instance", token.instanceId || String(++nextTokenInstanceRef.current));
    if (token.previewUrl) chip.setAttribute("data-token-preview", token.previewUrl);
    if (token.mediaKind) chip.setAttribute("data-token-media-kind", token.mediaKind);
    chip.append(tokenVisual(token));
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
      const deletionRange = document.createRange();
      deletionRange.selectNode(chip);
      removeSelection(deletionRange, [chip]);
    });
    chip.append(remove);
    return chip;
  }

  /** 在当前选区插入有序文本与标签，并为粘贴出的标签创建新的实例标识。 */
  function insertParts(parts: ComposerPart[]) {
    const range = caretRange();
    range.deleteContents();
    const fragment = document.createDocumentFragment();
    let lastNode: Node | null = null;
    for (const part of parts) {
      if (part.type === "text") {
        const textNode = document.createTextNode(part.text);
        fragment.append(textNode);
        lastNode = textNode;
        continue;
      }
      const chip = createTokenChip({ ...part.token, instanceId: undefined });
      const spacer = document.createTextNode("\u200b");
      fragment.append(chip, spacer);
      lastNode = spacer;
    }
    if (!lastNode) return;
    range.insertNode(fragment);
    if (lastNode.nodeType === Node.TEXT_NODE) range.setStart(lastNode, lastNode.textContent?.length ?? 0);
    else range.setStartAfter(lastNode);
    range.collapse(true);
    focusAt(range);
    sync();
  }

  /** 读取当前编辑器选区，并保留其中标签的结构化信息。 */
  function selectedDocument() {
    const editor = editorRef.current;
    const selection = window.getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
    if (!editor || !range || range.collapsed || !editor.contains(range.commonAncestorContainer)) return null;
    const container = document.createElement("div");
    container.append(range.cloneContents());
    const parts = readParts(container);
    return parts.length ? { range, parts } : null;
  }

  /** 同时写入 Weavl 结构化格式和跨应用兼容的纯文本格式。 */
  function writeSelectionToClipboard(event: ReactClipboardEvent<HTMLDivElement>) {
    const selected = selectedDocument();
    if (!selected) return null;
    event.preventDefault();
    event.clipboardData.setData(COMPOSER_CLIPBOARD_TYPE, JSON.stringify(selected.parts));
    event.clipboardData.setData("text/plain", partsToPlainText(selected.parts));
    return selected;
  }

  useImperativeHandle(ref, () => ({
    insertToken(token, focus = true, replaceMention = false) {
      const editor = editorRef.current;
      if (!editor) return;
      const range = caretRange();
      if (replaceMention) removeMentionAtCaret(range);
      const chip = createTokenChip(token);
      range.insertNode(chip);
      const spacer = document.createTextNode("\u200b");
      chip.after(spacer);
      /* 光标必须落在可编辑文本节点内，否则中文输入法会先提交一个拉丁字母再启动组合输入。 */
      range.setStart(spacer, spacer.data.length);
      range.collapse(true);
      if (focus) focusAt(range);
      else rangeRef.current = range.cloneRange();
      sync(!focus, false);
    },
    hasToken(type, id) {
      const editor = editorRef.current;
      if (!editor) return false;
      return Boolean(
        editor.querySelector(`[data-token-type="${CSS.escape(type)}"][data-token-id="${CSS.escape(id)}"]`),
      );
    },
    removeToken(type, id) {
      const editor = editorRef.current;
      if (!editor) return;
      editor
        .querySelectorAll(`[data-token-type="${CSS.escape(type)}"][data-token-id="${CSS.escape(id)}"]`)
        .forEach(removeChip);
      sync(true);
    },
    setDocument(parts) {
      const editor = editorRef.current;
      if (!editor || editor.contains(document.activeElement)) return;
      const fragment = document.createDocumentFragment();
      parts.forEach((part) => {
        if (part.type === "text") fragment.append(document.createTextNode(part.text));
        else {
          const chip = createTokenChip(part.token);
          fragment.append(chip, document.createTextNode("\u200b"));
        }
      });
      editor.replaceChildren(fragment);
      knownTokensRef.current = [...editor.querySelectorAll("[data-token-type]")].map(tokenFromNode);
      editor.dataset.empty = hasVisibleParts(parts) ? "false" : "true";
      rangeRef.current = null;
    },
    focus() {
      editorRef.current?.focus();
    },
    clear() {
      const editor = editorRef.current;
      if (!editor) return;
      editor.replaceChildren();
      editor.dataset.empty = "true";
      knownTokensRef.current = [];
      rangeRef.current = null;
      callbacksRef.current.onValueChange("");
    },
  }));

  useEffect(() => {
    const onSelectionChange = () => {
      saveRange();
      if (editorRef.current) renderTokenSelection(editorRef.current);
    };
    const onPointerDown = (event: PointerEvent) => {
      const editor = editorRef.current;
      const target = event.target;
      if (!editor || !(target instanceof Element)) return;
      const clickedToken = target.closest("[data-token-type]");
      if (!clickedToken || !editor.contains(clickedToken)) clearTokenSelection(editor);
    };
    document.addEventListener("selectionchange", onSelectionChange);
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      document.removeEventListener("selectionchange", onSelectionChange);
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, []);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || document.activeElement === editor || readText(editor) === value) return;
    editor.replaceChildren(document.createTextNode(value));
    editor.dataset.empty = hasVisibleText(value) ? "false" : "true";
  }, [value]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      callbacksRef.current.onEscape?.();
      return;
    }
    if ((event.key === "Backspace" || event.key === "Delete") && !event.nativeEvent.isComposing) {
      const editor = editorRef.current;
      const selection = window.getSelection();
      const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
      if (editor && range) {
        const selectedTokens = tokensInSelection(editor, range);
        const adjacent = range.collapsed
          ? adjacentToken(range, event.key === "Backspace" ? "backward" : "forward")
          : null;
        if (selectedTokens.length) {
          event.preventDefault();
          removeSelection(range, selectedTokens);
          return;
        }
        if (adjacent) {
          event.preventDefault();
          const deletionRange = document.createRange();
          deletionRange.selectNode(adjacent);
          removeSelection(deletionRange, [adjacent]);
          return;
        }
      }
    }
    if (event.key !== "Enter" || event.nativeEvent.isComposing || event.keyCode === 229) return;
    event.preventDefault();
    if (preventSubmit) return;
    if (!submitOnEnter || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) {
      document.execCommand("insertLineBreak");
      sync();
    } else callbacksRef.current.onSubmit();
  }

  return (
    <div
      ref={editorRef}
      className={`${styles.editor} ${className ?? ""}`}
      contentEditable={!disabled}
      suppressContentEditableWarning
      role="textbox"
      aria-label={ariaLabel}
      aria-multiline="true"
      data-placeholder={placeholder}
      data-empty="true"
      title={submitOnEnter ? "Enter 发送；Shift / Ctrl / Command + Enter 换行" : "Enter 换行；点击发送按钮提交"}
      onCompositionStart={() => {
        composingRef.current = true;
        /* 拼音组合文字已进入 DOM，但完整同步会打断输入法；先单独隐藏空态占位。 */
        if (editorRef.current) editorRef.current.dataset.empty = "false";
      }}
      onCompositionEnd={() => {
        composingRef.current = false;
        sync();
      }}
      onInput={() => {
        /* IME 组合期间不向 React Flow 回写，避免重渲染打断尚未确认的拼音。 */
        if (!composingRef.current) sync();
      }}
      onKeyDown={onKeyDown}
      onKeyUp={saveRange}
      onMouseUp={saveRange}
      onClick={(event) => {
        const target = event.target as HTMLElement;
        if (target.closest(`.${styles.remove}`)) return;
        const token = target.closest<HTMLElement>("[data-token-type]");
        const editor = editorRef.current;
        if (!token || !editor?.contains(token)) return;
        const range = document.createRange();
        range.selectNode(token);
        focusAt(range);
        renderTokenSelection(editor);
      }}
      onCopy={(event) => {
        writeSelectionToClipboard(event);
      }}
      onCut={(event) => {
        const selected = writeSelectionToClipboard(event);
        const editor = editorRef.current;
        if (selected && editor) removeSelection(selected.range, tokensInSelection(editor, selected.range));
      }}
      onPaste={(event) => {
        event.preventDefault();
        const parts = parseClipboardParts(event.clipboardData.getData(COMPOSER_CLIPBOARD_TYPE));
        if (parts) insertParts(parts);
        else insertText(event.clipboardData.getData("text/plain"));
      }}
    />
  );
});
