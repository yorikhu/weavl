"use client";

import type { KeyboardEvent, TextareaHTMLAttributes } from "react";
import { scrollCaretIntoView, scrollToLatestLine } from "@/utils/textareaCaret";

type ComposerTextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange" | "onKeyDown"> & {
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: () => void;
  onKeyDown?: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
};

/** 创作输入统一行为：Enter 提交，Shift/Ctrl/Command + Enter 换行。 */
export function ComposerTextarea({ value, onValueChange, onSubmit, onKeyDown, ...props }: ComposerTextareaProps) {
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
