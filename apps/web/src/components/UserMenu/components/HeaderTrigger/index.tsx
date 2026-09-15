"use client";

import { Coins, User } from "lucide-react";
import { forwardRef, type ComponentPropsWithoutRef } from "react";
import type { AccountPlanId } from "@weavl/shared";
import { HeaderCapsule } from "@/components/HeaderCapsule";
import { formatNumber } from "@/utils/formatNumber";
import styles from "./index.module.scss";

interface HeaderTriggerProps extends Omit<ComponentPropsWithoutRef<typeof HeaderCapsule>, "children" | "endInset"> {
  credits: number;
  plan: AccountPlanId;
}

/** UserMenu 的页头入口，同时展示积分、套餐与用户头像。 */
export const HeaderTrigger = forwardRef<HTMLButtonElement, HeaderTriggerProps>(function HeaderTrigger(
  { credits, plan, ...props },
  ref,
) {
  return (
    <HeaderCapsule ref={ref} endInset {...props}>
      <span className={styles.credits}>
        <Coins size={12} />
        <span>{formatNumber(credits)}</span>
      </span>
      <span className={styles.divider} aria-hidden="true" />
      <span className={styles.plan}>{plan}</span>
      <span className={styles.avatar}>
        <User size={14} />
      </span>
    </HeaderCapsule>
  );
});
