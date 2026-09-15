"use client";

import { useContext, useId, type InputHTMLAttributes } from "react";
import { FormContext } from "../../context";
import styles from "../../index.module.scss";
import type { FieldProps } from "../../types";
import { Field } from "../Field";

/** 单行输入框属性，可通过 name 接入 Form，也可使用 value/onChange 单独受控。 */
export type InputProps = InputHTMLAttributes<HTMLInputElement> & FieldProps;

/** 带统一标签、说明和受控能力的单行输入框。 */
export function Input({ name, label, hint, id, className, value, onChange, required, ...props }: InputProps) {
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
        className={[styles.control, className].filter(Boolean).join(" ")}
        value={bound ? (form!.values[name!] ?? "") : value}
        onChange={(event) => {
          if (bound) form!.change(name!, event.target.value);
          onChange?.(event);
        }}
      />
    </Field>
  );
}
