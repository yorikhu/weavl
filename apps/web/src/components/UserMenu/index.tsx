"use client";

import { DropdownMenu as DropdownMenuPrimitive, Switch as SwitchPrimitive } from "radix-ui";
import { useRouter } from "next/navigation";
import { Bell, CreditCard, Crown, LogOut, Moon, Terminal, User, UserCircle2 } from "lucide-react";
import { useTheme } from "@/provider/ThemeProvider";
import styles from "./index.module.scss";

const DM = DropdownMenuPrimitive;
const Switch = SwitchPrimitive.Root;
const SwitchThumb = SwitchPrimitive.Thumb;

/** 头像下拉菜单：会员/积分/存储/个人中心/订阅发票/CLI/通知/主题 Switch/退出 */
export function UserMenu() {
  const router = useRouter();
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";

  return (
    <DM.Root>
      <DM.Trigger asChild className={styles.trigger}>
        <button aria-label="用户菜单">
          <span className={styles.avatar}>
            <User size={16} />
          </span>
          <span className={styles.avatarDot} />
        </button>
      </DM.Trigger>

      <DM.Portal>
        <DM.Content sideOffset={8} align="end" className={`${styles.content} glass-strong glass-sheen`}>
          {/* 会员头卡 */}
          <div className={`${styles.profileCard} glass`}>
            <div className={styles.profileLeft}>
              <span className={styles.profileAvatar}>
                <User size={16} />
              </span>
              <div>
                <p className={styles.profileName}>织光师_9f2c</p>
                <p className={styles.profilePlan}>
                  <Crown size={10} className={styles.itemIcon} />
                  免费版 · 未开通会员
                </p>
              </div>
            </div>
            <button className={styles.upgradeBtn}>升级</button>
          </div>

          {/* 积分 + 存储 */}
          <div className={styles.statsRow}>
            <span className={styles.stat}>
              <span className={styles.statLabel}>积分</span>
              <span className={styles.statValue}>0</span>
            </span>
          </div>
          <div className={styles.statsRow}>
            <span className={styles.stat}>
              <span className={styles.statLabel}>存储</span>
              <span className={styles.statValue}>2.1G / 10G</span>
            </span>
          </div>

          <DM.Separator className={styles.separator} />

          <DM.Item className={styles.item} onSelect={() => router.push("/profile")}>
            <span className={styles.itemLeft}>
              <UserCircle2 size={14} className={styles.itemIcon} />
              个人中心
            </span>
          </DM.Item>
          <DM.Item className={styles.item}>
            <span className={styles.itemLeft}>
              <CreditCard size={14} className={styles.itemIcon} />
              订阅与发票
            </span>
          </DM.Item>
          <DM.Item className={styles.item}>
            <span className={styles.itemLeft}>
              <Terminal size={14} className={styles.itemIcon} />
              CLI &amp; Skill
            </span>
          </DM.Item>
          <DM.Item className={styles.item}>
            <span className={styles.itemLeft}>
              <Bell size={14} className={styles.itemIcon} />
              通知
            </span>
            <span className={styles.itemHint}>3 条未读</span>
          </DM.Item>

          <DM.Separator className={styles.separator} />

          {/* 深色模式 Switch（自绘行，非 DM.Item） */}
          <div className={styles.switchRow}>
            <span className={styles.itemLeft}>
              <Moon size={14} className={styles.itemIcon} />
              深色模式
            </span>
            <Switch
              checked={isDark}
              onCheckedChange={() => toggle()}
              className={styles.switch}
              aria-label="切换深色模式"
            >
              <SwitchThumb className={styles.switchThumb} />
            </Switch>
          </div>

          <DM.Separator className={styles.separator} />

          <DM.Item className={`${styles.item} ${styles.danger}`}>
            <span className={styles.itemLeft}>
              <LogOut size={14} className={styles.itemIcon} />
              退出登录
            </span>
          </DM.Item>
        </DM.Content>
      </DM.Portal>
    </DM.Root>
  );
}
