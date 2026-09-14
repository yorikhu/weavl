"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Coins, UserRound } from "lucide-react";
import type { AccountPlanId } from "@weavl/shared";
import styles from "./index.module.scss";

type SidebarAccountTriggerProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  plan: AccountPlanId;
  credits: number;
  collapsed: boolean;
};

export const SidebarAccountTrigger = forwardRef<HTMLButtonElement, SidebarAccountTriggerProps>(
  function SidebarAccountTrigger({ plan, credits, collapsed, className, ...props }, ref) {
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
          <span>{credits}</span>
        </span>
      </button>
    );
  },
);
