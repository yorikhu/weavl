"use client";

import { useContext, useId, type ChangeEvent, type KeyboardEvent, type TextareaHTMLAttributes } from "react";
import { scrollCaretIntoView, scrollToLatestLine } from "@/utils/textareaCaret";
import { FormContext } from "../../context";
import styles from "../../index.module.scss";
import type { FieldProps } from "../../types";
import { Field } from "../Field";

/** 通用多行输入框属性，额外支持直接接收字符串的 onValueChange。 */
export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> &
  FieldProps & { onValueChange?: (value: string) => void };

/**
 * 自动保持光标可见，并支持 Ctrl/Command + Enter 插入换行的多行输入框。
 *
 * @param props - 原生多行输入框、字段展示和 Form 受控属性。
 * @returns 可独立使用或接入 Form 的多行输入框。
 */
export function Textarea({
  name,
  label,
  hint,
  id,
  className,
  value,
  onChange,
  onValueChange,
  onKeyDown,
  required,
  ...props
}: TextareaProps) {
  const form = useContext(FormContext);
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const bound = Boolean(form && name);

  function change(event: ChangeEvent<HTMLTextAreaElement>) {
    const element = event.currentTarget;
    const caret = element.selectionStart;
    if (bound) form!.change(name!, element.value);
    onValueChange?.(element.value);
    onChange?.(event);
    scrollToLatestLine(element, caret);
  }

  function keyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    onKeyDown?.(event);
    if (
      event.defaultPrevented ||
      event.key !== "Enter" ||
      (!event.ctrlKey && !event.metaKey) ||
      event.nativeEvent.isComposing ||
      event.keyCode === 229
    )
      return;
    event.preventDefault();
    const element = event.currentTarget;
    const start = element.selectionStart;
    const next = `${element.value.slice(0, start)}\n${element.value.slice(element.selectionEnd)}`;
    if (bound) form!.change(name!, next);
    else if (onValueChange) onValueChange(next);
    else {
      const nativeSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
      nativeSetter?.call(element, next);
      element.dispatchEvent(new Event("input", { bubbles: true }));
    }
    requestAnimationFrame(() => {
      element.setSelectionRange(start + 1, start + 1);
      if (element.isConnected) scrollCaretIntoView(element, start + 1);
    });
  }

  return (
    <Field id={fieldId} label={label} hint={hint} required={required}>
      <textarea
        {...props}
        id={fieldId}
        name={name}
        required={required}
        className={[styles.control, styles.textarea, className].filter(Boolean).join(" ")}
        value={bound ? (form!.values[name!] ?? "") : value}
        onChange={change}
        onKeyDown={keyDown}
      />
    </Field>
  );
}
