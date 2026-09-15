"use client";

import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";

import styles from "./index.module.scss";

/** HeaderCapsule 的选中状态及末端缩进配置。 */
export interface HeaderCapsuleProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  endInset?: boolean;
}

const cx = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(" ");

/**
 * Header 中通用的卡片式操作胶囊，可直接作为 Popover trigger 使用。
 */
export const HeaderCapsule = forwardRef<HTMLButtonElement, HeaderCapsuleProps>(function HeaderCapsule(
  { active = false, endInset = false, className, type = "button", children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx(styles.root, active && styles.active, endInset && styles.endInset, className)}
      {...props}
    >
      {children}
    </button>
  );
});
