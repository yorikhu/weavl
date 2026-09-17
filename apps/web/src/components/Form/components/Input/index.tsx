"use client";

import { useContext, useId, type InputHTMLAttributes } from "react";
import { FormContext } from "../../context";
import styles from "../../index.module.scss";
import type { FieldProps } from "../../types";
import { Field } from "../Field";

/** 单行输入框属性，可通过 name 接入 Form，也可使用 value/onChange 单独受控。 */
export type InputProps = InputHTMLAttributes<HTMLInputElement> &
  FieldProps & {
    /** bare 用于搜索栏等已有外层边框的复合控件。 */
    variant?: "default" | "bare";
  };

/**
 * 带统一标签、说明和受控能力的单行输入框。
 *
 * @param props - 原生输入框、字段展示和 Form 受控属性。
 * @returns 可独立使用或接入 Form 的单行输入框。
 */
export function Input({
  name,
  label,
  hint,
  id,
  className,
  value,
  onChange,
  required,
  variant = "default",
  ...props
}: InputProps) {
  const form = useContext(FormContext);
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const bound = Boolean(form && name);
  return (
    <Field id={fieldId} label={label} hint={hint} required={required}>
      <input
        {...props}
        id={fieldId}
        name={name}
        required={required}
        className={[styles.control, variant === "bare" ? styles.bareControl : undefined, className]
          .filter(Boolean)
          .join(" ")}
        value={bound ? (form!.values[name!] ?? "") : value}
        onChange={(event) => {
          if (bound) form!.change(name!, event.target.value);
          onChange?.(event);
        }}
      />
    </Field>
  );
}
