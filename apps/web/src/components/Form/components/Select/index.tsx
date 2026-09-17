"use client";

import { useContext, useId, type SelectHTMLAttributes } from "react";
import { FormContext } from "../../context";
import styles from "../../index.module.scss";
import type { FieldProps } from "../../types";
import { Field } from "../Field";

/** 下拉选择框属性，可通过 name 接入 Form，也可使用 value/onChange 单独受控。 */
export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & FieldProps;

/**
 * 带统一标签、说明和受控能力的原生下拉选择框。
 *
 * @param props - 原生选择框、字段展示和 Form 受控属性。
 * @returns 可独立使用或接入 Form 的下拉选择框。
 */
export function Select({ name, label, hint, id, className, value, onChange, required, children, ...props }: SelectProps) {
  const form = useContext(FormContext);
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const bound = Boolean(form && name);
  return (
    <Field id={fieldId} label={label} hint={hint} required={required}>
      <select
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
      >
        {children}
      </select>
    </Field>
  );
}
