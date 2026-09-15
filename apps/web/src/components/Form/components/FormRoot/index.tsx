"use client";

import type { FormEvent } from "react";
import { FormContext, type FormValues } from "../../context";
import type { FormProps } from "../../types";

/** 为带 name 的 Form 子控件提供受控值，并统一处理原生表单提交。 */
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
