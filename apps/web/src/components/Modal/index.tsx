"use client";

import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import styles from "./index.module.scss";

/** 内容弹窗与确认弹窗共享的基础属性。 */
interface ModalBaseProps {
  open: boolean;
  title: string;
  eyebrow?: string;
  description?: string;
  busy?: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ContentModalProps extends ModalBaseProps {
  mode?: "content";
  children: ReactNode;
}

interface ConfirmModalProps extends ModalBaseProps {
  mode: "confirm";
  description: string;
  children?: never;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
}

/**
 * Modal 的两种使用方式：默认 mode 展示自定义 children，confirm mode 自动生成确认操作区。
 */
export type ModalProps = ContentModalProps | ConfirmModalProps;

/** 根据 mode 渲染自定义内容弹窗或标准确认弹窗。 */
function ModalRoot(props: ModalProps) {
  const { open, title, eyebrow, description, busy = false, onOpenChange } = props;
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(nextOpen) => !busy && onOpenChange(nextOpen)}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={styles.overlay} />
        <DialogPrimitive.Content className={styles.content}>
          <header className={styles.header}>
            {eyebrow && <span className={styles.eyebrow}>{eyebrow}</span>}
            <DialogPrimitive.Title className={styles.title}>{title}</DialogPrimitive.Title>
            {description && (
              <DialogPrimitive.Description className={styles.description}>{description}</DialogPrimitive.Description>
            )}
          </header>
          {props.mode === "confirm" ? (
            <Footer>
              <Button type="button" variant="quiet" disabled={busy} onClick={() => onOpenChange(false)}>
                {props.cancelLabel ?? "取消"}
              </Button>
              <Button
                type="button"
                variant={props.danger ? "danger" : "primary"}
                disabled={busy}
                onClick={() => void props.onConfirm()}
              >
                {busy ? "处理中…" : (props.confirmLabel ?? "确认")}
              </Button>
            </Footer>
          ) : (
            props.children
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** Modal 内统一对齐操作按钮的底部区域。 */
function Footer({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={[styles.footer, className].filter(Boolean).join(" ")} />;
}

type ModalButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "quiet" | "danger" };
/** 适配 Modal 明暗主题的主操作、次操作与危险操作按钮。 */
function Button({ variant = "primary", className, ...props }: ModalButtonProps) {
  return <button {...props} className={[styles.button, styles[variant], className].filter(Boolean).join(" ")} />;
}

/**
 * 全局弹窗组件。可直接使用 Modal，也可用 Modal.Footer 和 Modal.Button 组合自定义操作区。
 */
export const Modal = Object.assign(ModalRoot, { Footer, Button });
