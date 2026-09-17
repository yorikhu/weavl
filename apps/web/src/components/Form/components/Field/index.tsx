import type { ReactNode } from "react";
import styles from "../../index.module.scss";
import type { FieldProps } from "../../types";

interface Props extends FieldProps {
  id: string;
  required?: boolean;
  children: ReactNode;
}

/**
 * 为表单控件统一渲染 label、必填标记和辅助说明。
 *
 * @param props - 字段标识、标签、说明和子控件。
 * @returns 包含字段说明的表单项；无说明时直接返回子控件。
 */
export function Field({ id, label, hint, required, children }: Props) {
  if (!label && !hint) return children;
  return (
    <div className={styles.field}>
      {label && (
        <label className={styles.label} htmlFor={id}>
          {label}
          {required && <span className={styles.required}> *</span>}
        </label>
      )}
      {children}
      {hint && <span className={styles.hint}>{hint}</span>}
    </div>
  );
}
