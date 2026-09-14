"use client";

import {
  createContext,
  useContext,
  useId,
  type ChangeEvent,
  type FormEvent,
  type FormHTMLAttributes,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import styles from "./index.module.scss";
import { scrollCaretIntoView, scrollToLatestLine } from "@/utils/textareaCaret";

type Values = Record<string, string>;
type FormContextValue = { values: Values; change: (name: string, value: string) => void };
const FormContext = createContext<FormContextValue | null>(null);

type FormProps<T extends Values> = Omit<FormHTMLAttributes<HTMLFormElement>, "onSubmit" | "onChange"> & {
  values: T;
  onValuesChange: (values: T) => void;
  onFinish?: (values: T) => void | Promise<void>;
};

function FormRoot<T extends Values>({ values, onValuesChange, onFinish, children, ...props }: FormProps<T>) {
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

type FieldProps = { label?: ReactNode; hint?: ReactNode };

function Field({
  id,
  label,
  hint,
  required,
  children,
}: FieldProps & { id: string; required?: boolean; children: ReactNode }) {
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

type InputProps = InputHTMLAttributes<HTMLInputElement> & FieldProps;
function Input({ name, label, hint, id, className, value, onChange, required, ...props }: InputProps) {
  const form = useContext(FormContext);
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const bound = !!form && !!name;
  return (
    <Field id={fieldId} label={label} hint={hint} required={required}>
      <input
        {...props}
        id={fieldId}
        name={name}
        required={required}
        className={[styles.control, className].filter(Boolean).join(" ")}
        value={bound ? (form.values[name] ?? "") : value}
        onChange={(event) => {
          if (bound) form.change(name, event.target.value);
          onChange?.(event);
        }}
      />
    </Field>
  );
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> &
  FieldProps & {
    onValueChange?: (value: string) => void;
  };
function Textarea({
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
  const bound = !!form && !!name;

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
        value={bound ? (form.values[name] ?? "") : value}
        onChange={change}
        onKeyDown={keyDown}
      />
    </Field>
  );
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & FieldProps;
function Select({ name, label, hint, id, className, value, onChange, required, children, ...props }: SelectProps) {
  const form = useContext(FormContext);
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const bound = !!form && !!name;
  return (
    <Field id={fieldId} label={label} hint={hint} required={required}>
      <select
        {...props}
        id={fieldId}
        name={name}
        required={required}
        className={[styles.control, className].filter(Boolean).join(" ")}
        value={bound ? (form.values[name] ?? "") : value}
        onChange={(event) => {
          if (bound) form.change(name, event.target.value);
          onChange?.(event);
        }}
      >
        {children}
      </select>
    </Field>
  );
}

export const Form = Object.assign(FormRoot, { Input, Textarea, Select });
