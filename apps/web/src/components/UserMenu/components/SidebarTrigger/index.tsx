"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Coins, UserRound } from "lucide-react";
import type { AccountPlanId } from "@weavl/shared";
import { formatNumber } from "@/utils/formatNumber";
import styles from "./index.module.scss";

interface SidebarTriggerProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  plan: AccountPlanId;
  credits: number;
  collapsed: boolean;
}

/** UserMenu 的侧栏入口，按侧栏展开状态切换横向与纵向布局。 */
export const SidebarTrigger = forwardRef<HTMLButtonElement, SidebarTriggerProps>(function SidebarTrigger(
  { plan, credits, collapsed, className, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      className={[styles.root, collapsed && styles.collapsed, className].filter(Boolean).join(" ")}
      {...props}
    >
      <span className={styles.avatar}>
        <UserRound size={15} strokeWidth={1.8} />
      </span>
      <span className={styles.plan}>{plan}</span>
      <span className={styles.credits}>
        <Coins size={13} />
        <span>{formatNumber(credits)}</span>
      </span>
    </button>
  );
});
