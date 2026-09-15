import type { FormHTMLAttributes, ReactNode } from "react";
import type { FormValues } from "./context";

/** Form 根组件的受控值与提交协议。 */
export type FormProps<T extends FormValues> = Omit<FormHTMLAttributes<HTMLFormElement>, "onSubmit" | "onChange"> & {
  values: T;
  onValuesChange: (values: T) => void;
  onFinish?: (values: T) => void | Promise<void>;
};

/** 所有表单控件共享的标签与辅助说明属性。 */
export interface FieldProps {
  label?: ReactNode;
  hint?: ReactNode;
}
