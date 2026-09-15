"use client";

import { useContext, useId, type KeyboardEvent, type TextareaHTMLAttributes } from "react";
import { scrollCaretIntoView, scrollToLatestLine } from "@/utils/textareaCaret";
import { FormContext } from "../../context";
import type { FieldProps } from "../../types";
import { Field } from "../Field";

/** 创作型纯文本输入框属性，可通过 name 接入 Form 或单独受控。 */
export type ComposerTextareaProps = Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "value" | "onChange" | "onKeyDown"
> &
  FieldProps & {
    value?: string;
    onValueChange?: (value: string) => void;
    onSubmit: () => void;
    onKeyDown?: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  };

/** 纯文本创作输入框：Enter 提交，Shift/Ctrl/Command + Enter 换行。 */
export function ComposerTextarea({
  name,
  label,
  hint,
  id,
  required,
  value = "",
  onValueChange,
  onSubmit,
  onKeyDown,
  ...props
}: ComposerTextareaProps) {
  const form = useContext(FormContext);
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const bound = Boolean(form && name);
  const controlledValue = bound ? (form!.values[name!] ?? "") : value;

  function change(nextValue: string) {
    if (bound) form!.change(name!, nextValue);
    onValueChange?.(nextValue);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    onKeyDown?.(event);
    if (event.defaultPrevented || event.key !== "Enter" || event.nativeEvent.isComposing || event.keyCode === 229)
      return;
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      const textarea = event.currentTarget;
      const caret = textarea.selectionStart + 1;
      change(`${textarea.value.slice(0, textarea.selectionStart)}\n${textarea.value.slice(textarea.selectionEnd)}`);
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
    <Field id={fieldId} label={label} hint={hint} required={required}>
      <textarea
        {...props}
        id={fieldId}
        name={name}
        required={required}
        value={controlledValue}
        onChange={(event) => {
          const textarea = event.currentTarget;
          const caret = textarea.selectionStart;
          change(textarea.value);
          scrollToLatestLine(textarea, caret);
        }}
        onKeyDown={handleKeyDown}
      />
    </Field>
  );
}
