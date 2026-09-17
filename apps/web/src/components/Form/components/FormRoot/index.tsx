"use client";

import type { FormEvent } from "react";
import { FormContext, type FormValues } from "../../context";
import type { FormProps } from "../../types";

/**
 * 为带 name 的 Form 子控件提供受控值，并统一处理原生表单提交。
 *
 * @template T - 表单受控值结构。
 * @param props - 表单值、变更回调、提交回调和原生表单属性。
 * @returns 为子控件提供受控上下文的 form 元素。
 */
export function FormRoot<T extends FormValues>({ values, onValuesChange, onFinish, children, ...props }: FormProps<T>) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onFinish?.(values);
  }

  return (
    <FormContext.Provider value={{ values, change: (name, value) => onValuesChange({ ...values, [name]: value }) }}>
      <form {...props} onSubmit={submit}>
        {children}
      </form>
    </FormContext.Provider>
  );
}
