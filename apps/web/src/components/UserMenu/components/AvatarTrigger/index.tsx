"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { User } from "lucide-react";
import styles from "./index.module.scss";

/** UserMenu 的紧凑头像入口，用于空间有限的工具栏。 */
export const AvatarTrigger = forwardRef<
  HTMLButtonElement,
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children">
>(function AvatarTrigger({ className, ...props }, ref) {
  return (
    <button ref={ref} type="button" className={[styles.trigger, className].filter(Boolean).join(" ")} {...props}>
      <span className={styles.avatar}>
        <User size={16} />
      </span>
      <span className={styles.dot} />
    </button>
  );
});
