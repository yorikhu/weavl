"use client";

import type { KeyboardEvent, TextareaHTMLAttributes } from "react";

type ComposerTextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange" | "onKeyDown"> & {
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: () => void;
  onKeyDown?: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
};

/** 创作输入统一行为：Enter 提交，Shift/Ctrl/Command + Enter 换行。 */
export function ComposerTextarea({ value, onValueChange, onSubmit, onKeyDown, ...props }: ComposerTextareaProps) {
  function scrollCaretIntoView(textarea: HTMLTextAreaElement, caret: number) {
    if (caret === textarea.value.length) {
      textarea.scrollTop = textarea.scrollHeight;
      return;
    }

    const style = getComputedStyle(textarea);
    const mirror = document.createElement("div");
    Object.assign(mirror.style, {
      position: "absolute",
      left: "-9999px",
      width: `${textarea.clientWidth}px`,
      boxSizing: "border-box",
      padding: style.padding,
      font: style.font,
      letterSpacing: style.letterSpacing,
      lineHeight: style.lineHeight,
      whiteSpace: "pre-wrap",
      overflowWrap: style.overflowWrap,
      wordBreak: style.wordBreak,
      tabSize: style.tabSize,
      visibility: "hidden",
    });
    mirror.append(document.createTextNode(textarea.value.slice(0, caret)));
    const marker = document.createElement("span");
    marker.textContent = "\u200b";
    mirror.append(marker);
    document.body.append(mirror);
    const caretTop = marker.offsetTop;
    mirror.remove();

    const lineHeight = Number.parseFloat(style.lineHeight) || 20;
    if (caretTop < textarea.scrollTop) textarea.scrollTop = caretTop;
    else if (caretTop + lineHeight > textarea.scrollTop + textarea.clientHeight)
      textarea.scrollTop = caretTop + lineHeight - textarea.clientHeight;
  }

  function scrollToLatestLine(textarea: HTMLTextAreaElement, caret: number) {
    window.requestAnimationFrame(() => {
      if (textarea.isConnected && caret === textarea.value.length) textarea.scrollTop = textarea.scrollHeight;
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    onKeyDown?.(event);
    if (event.defaultPrevented || event.key !== "Enter" || event.nativeEvent.isComposing || event.keyCode === 229)
      return;

    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      const textarea = event.currentTarget;
      const caret = textarea.selectionStart + 1;
      onValueChange(
        `${textarea.value.slice(0, textarea.selectionStart)}\n${textarea.value.slice(textarea.selectionEnd)}`,
      );
      window.requestAnimationFrame(() => {
        textarea.setSelectionRange(caret, caret);
        scrollCaretIntoView(textarea, caret);
      });
      return;
    }

    if (event.shiftKey || event.altKey) return;
    event.preventDefault();
    onSubmit();
  }

  return (
    <textarea
      {...props}
      value={value}
      onChange={(event) => {
        const textarea = event.currentTarget;
        const caret = textarea.selectionStart;
        onValueChange(textarea.value);
        scrollToLatestLine(textarea, caret);
      }}
      onKeyDown={handleKeyDown}
    />
  );
}
