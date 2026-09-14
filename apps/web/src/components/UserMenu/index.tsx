"use client";

import { Switch as SwitchPrimitive } from "radix-ui";
import type { ReactElement } from "react";
import { useRouter } from "next/navigation";
import { Bell, CreditCard, Crown, LogOut, Moon, Terminal, User, UserCircle2 } from "lucide-react";
import { Popover, type PopoverProps } from "@/components/Popover";
import { useTheme } from "@/provider/ThemeProvider";
import { useAuth } from "@/provider/AuthProvider";
import { useAccount } from "@/provider/AccountProvider";
import styles from "./index.module.scss";

const Switch = SwitchPrimitive.Root;
const SwitchThumb = SwitchPrimitive.Thumb;
const storageLabel = (bytes: number) =>
  bytes < 1024 ** 2 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 ** 2).toFixed(1)} MB`;

interface UserMenuProps {
  trigger?: ReactElement;
  side?: PopoverProps["side"];
  align?: PopoverProps["align"];
}

/** 头像下拉菜单：会员/积分/存储/个人中心/订阅发票/CLI/通知/主题 Switch/退出 */
export function UserMenu({ trigger, side = "bottom", align = "end" }: UserMenuProps = {}) {
  const router = useRouter();
  const { theme, toggle } = useTheme();
  const { user, logout } = useAuth();
  const { account } = useAccount();
  const isDark = theme === "dark";

  return (
    <Popover
      mode="click"
      side={side}
      align={align}
      sideOffset={8}
      ariaLabel="用户菜单"
      contentRole="menu"
      showArrow={false}
      contentClassName={`${styles.content} glass-strong glass-sheen`}
      trigger={
        trigger ?? (
          <button className={styles.trigger} aria-label="用户菜单">
            <span className={styles.avatar}>
              <User size={16} />
            </span>
            <span className={styles.avatarDot} />
          </button>
        )
      }
    >
      <>
        {/* 会员头卡 */}
        <div className={`${styles.profileCard} glass`}>
          <div className={styles.profileLeft}>
            <span className={styles.profileAvatar}>
              <User size={16} />
            </span>
            <div>
              <p className={styles.profileName}>{user?.name ?? "Weavl 用户"}</p>
              <p className={styles.profilePlan}>
                <Crown size={10} className={styles.itemIcon} />
                {account?.plan === "Free" ? "免费版" : (account?.plan ?? "读取中")}
              </p>
            </div>
          </div>
          <button className={styles.upgradeBtn} onClick={() => router.push("/profile?tab=plans")}>
            升级
          </button>
        </div>

        {/* 积分 + 存储 */}
        <div className={styles.statsRow}>
          <span className={styles.stat}>
            <span className={styles.statLabel}>积分</span>
            <span className={styles.statValue}>{account?.credits ?? "—"}</span>
          </span>
        </div>
        <div className={styles.statsRow}>
          <span className={styles.stat}>
            <span className={styles.statLabel}>存储</span>
            <span className={styles.statValue}>
              {account
                ? `${storageLabel(account.storageUsed)} / ${(account.storageLimit / 1024 ** 3).toFixed(0)} GB`
                : "读取中"}
            </span>
          </span>
        </div>

        <div className={styles.separator} role="separator" />

        <button type="button" role="menuitem" className={styles.item} onClick={() => router.push("/profile")}>
          <span className={styles.itemLeft}>
            <UserCircle2 size={14} className={styles.itemIcon} />
            个人中心
          </span>
        </button>
        <button
          type="button"
          role="menuitem"
          className={styles.item}
          onClick={() => router.push("/profile?tab=billing")}
        >
          <span className={styles.itemLeft}>
            <CreditCard size={14} className={styles.itemIcon} />
            订阅与发票
          </span>
        </button>
        <button type="button" role="menuitem" className={styles.item} onClick={() => router.push("/market?tab=skill")}>
          <span className={styles.itemLeft}>
            <Terminal size={14} className={styles.itemIcon} />
            CLI &amp; Skill
          </span>
        </button>
        <button
          type="button"
          role="menuitem"
          className={styles.item}
          onClick={() => router.push("/profile?tab=notifications")}
        >
          <span className={styles.itemLeft}>
            <Bell size={14} className={styles.itemIcon} />
            通知
          </span>
          <span className={styles.itemHint}>{account?.unreadNotifications ?? 0} 条未读</span>
        </button>

        <div className={styles.separator} role="separator" />

        {/* 深色模式 Switch（自绘行，非 DM.Item） */}
        <div className={styles.switchRow}>
          <span className={styles.itemLeft}>
            <Moon size={14} className={styles.itemIcon} />
            深色模式
          </span>
          <Switch checked={isDark} onCheckedChange={() => toggle()} className={styles.switch} aria-label="切换深色模式">
            <SwitchThumb className={styles.switchThumb} />
          </Switch>
        </div>

        <div className={styles.separator} role="separator" />

        <button
          type="button"
          role="menuitem"
          className={`${styles.item} ${styles.danger}`}
          onClick={() => void logout()}
        >
          <span className={styles.itemLeft}>
            <LogOut size={14} className={styles.itemIcon} />
            退出登录
          </span>
        </button>
      </>
    </Popover>
  );
}
