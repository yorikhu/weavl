"use client";

import { createContext } from "react";

/** 当前轻量表单支持的字段值集合。 */
export type FormValues = Record<string, string>;

/** Form 子控件读取字段并回写值的内部上下文。 */
export interface FormContextValue {
  values: FormValues;
  change: (name: string, value: string) => void;
}

/** 仅供 Form 及其内置控件共享状态，不作为业务状态容器使用。 */
export const FormContext = createContext<FormContextValue | null>(null);
