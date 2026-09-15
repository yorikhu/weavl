"use client";

import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import styles from "./index.module.scss";

interface ModalProps {
  open: boolean;
  title: string;
  eyebrow?: string;
  description?: string;
  busy?: boolean;
  children: ReactNode;
  onOpenChange: (open: boolean) => void;
}

function ModalRoot({ open, title, eyebrow, description, busy = false, children, onOpenChange }: ModalProps) {
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
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function Footer({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={[styles.footer, className].filter(Boolean).join(" ")} />;
}

type ModalButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "quiet" | "danger" };
function Button({ variant = "primary", className, ...props }: ModalButtonProps) {
  return <button {...props} className={[styles.button, styles[variant], className].filter(Boolean).join(" ")} />;
}

export const Modal = Object.assign(ModalRoot, { Footer, Button });
