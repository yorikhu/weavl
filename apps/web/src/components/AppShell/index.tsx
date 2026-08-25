"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Bell,
  Bot,
  Bookmark,
  CircleHelp,
  Coins,
  CreditCard,
  Crown,
  HardDrive,
  Heart,
  Layers,
  LayoutGrid,
  LogOut,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  ShoppingBag,
  Terminal,
  Trash2,
  User,
  Wand2,
} from "lucide-react";
import { useTheme } from "@/provider/ThemeProvider";
import { CreditsBadge } from "@/components/CreditsBadge";
import { StarburstLogo } from "@/components/StarburstLogo";
import { UserMenu } from "@/components/UserMenu";
import styles from "./index.module.scss";

const NAV_ITEMS = [
  { href: "/", label: "首页", icon: LayoutGrid },
  { href: "/projects", label: "项目", icon: Layers },
  { href: "/agent", label: "Agent 对话", icon: Bot },
  { href: "/market", label: "市场", icon: ShoppingBag },
  { href: "/preset", label: "预设", icon: Wand2 },
] as const;

const MY_SPACE_ITEMS = [
  { label: "我的预设", icon: Wand2 },
  { label: "我的作品", icon: Bookmark },
  { label: "我的收藏", icon: Heart },
  { label: "回收站", icon: Trash2 },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={styles.shell}>
      {/* ============ 左侧栏（通天） ============ */}
      <aside className={`${styles.sider} ${collapsed ? styles.collapsed : ""}`}>
        <div className={styles.siderTop}>
          {/* 品牌行：logo + 标题 + 常显收起按钮 */}
          {collapsed ? (
            // 收起态：logo 位，hover 变展开按钮
            <button
              className={styles.logoSlot}
              onClick={() => setCollapsed(false)}
              title="展开侧栏"
            >
              <span className={styles.logoSlotRoot}>
                <span className={styles.logoLayer}>
                  <StarburstLogo size={22} />
                </span>
                <span className={styles.expandLayer}>
                  <PanelLeftOpen size={18} />
                </span>
              </span>
            </button>
          ) : (
            // 展开态：logo+标题 + 常显收起按钮
            <div className={styles.brandRow}>
              <Link href="/" className={styles.brand}>
                <StarburstLogo size={22} />
                <span className={styles.brandText}>
                  <span className={styles.brandName}>Weavl</span>
                  <span className={styles.brandSub}>织光</span>
                </span>
              </Link>
              <button
                className={styles.collapseBtn}
                onClick={() => setCollapsed(true)}
                title="收起侧栏"
              >
                <PanelLeftClose size={16} />
              </button>
            </div>
          )}

          {/* 主导航 */}
          <nav className={styles.nav}>
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  className={`${styles.navItem} ${active ? styles.active : ""}`}
                >
                  <Icon size={16} />
                  {!collapsed && <span className={styles.navLabel}>{item.label}</span>}
                </Link>
              );
            })}
          </nav>

          {/* 我的空间（收起时隐藏） */}
          {!collapsed && (
            <div className={styles.spaceSection}>
              <p className={styles.spaceTitle}>我的空间</p>
              {MY_SPACE_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <button key={item.label} className={styles.spaceItem}>
                    <Icon size={14} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 底部帮助 */}
        <div className={styles.siderBottom}>
          <button className={styles.helpBtn} title="帮助与支持">
            <CircleHelp size={16} />
            {!collapsed && <span>帮助与支持</span>}
          </button>
        </div>
      </aside>

      {/* ============ 右侧：header + 内容 ============ */}
      <div className={styles.right}>
        <header className={`${styles.header} frost-header`}>
          <span className={styles.pageTitle}>
            {NAV_ITEMS.find((i) => i.href === pathname)?.label ?? "Weavl 织光"}
          </span>
          <div className={styles.headerRight}>
            <button className={styles.proBtn}>
              <Crown size={14} />
              开通会员
            </button>
            <CreditsBadge amount={0} />
            <UserMenu />
          </div>
        </header>
        <main className={styles.main}>{children}</main>
      </div>
    </div>
  );
}
