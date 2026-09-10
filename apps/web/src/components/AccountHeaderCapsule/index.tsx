"use client";

import { Coins, User } from "lucide-react";
import type { ComponentProps } from "react";

import { HeaderCapsule } from "@/components/HeaderCapsule";
import styles from "./index.module.scss";

type MembershipPlan = "Free" | "Plus" | "Pro" | "Max";

interface AccountHeaderCapsuleProps extends Omit<ComponentProps<typeof HeaderCapsule>, "children" | "endInset"> {
  amount: number;
  plan: MembershipPlan;
}

/** Header 账户入口：积分、会员等级与头像的统一组合胶囊。 */
export function AccountHeaderCapsule({ amount, plan, ...props }: AccountHeaderCapsuleProps) {
  return (
    <HeaderCapsule endInset {...props}>
      <span className={styles.credits}>
        <Coins size={12} />
        <span>{amount}</span>
      </span>
      <span className={styles.divider} aria-hidden="true" />
      <span className={styles.plan}>{plan}</span>
      <span className={styles.avatar}>
        <User size={14} />
      </span>
    </HeaderCapsule>
  );
}
