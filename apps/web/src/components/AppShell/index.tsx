"use client";

import { Fragment, useLayoutEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Bot,
  Layers,
  LayoutGrid,
  LogIn,
  PanelLeftClose,
  PanelLeftOpen,
  ShoppingBag,
  Workflow,
  FolderOpen,
} from "lucide-react";
import { StarburstLogo } from "@/components/StarburstLogo";
import { WeavlBrand } from "@/components/WeavlBrand";
import { Popover } from "@/components/Popover";
import { UserMenu } from "@/components/UserMenu";
import { SidebarAccountTrigger } from "@/components/SidebarAccountTrigger";
import { useAccount } from "@/provider/AccountProvider";
import styles from "./index.module.scss";
import { useAuth } from "@/provider/AuthProvider";

const NAV_ITEMS = [
  { href: "/agent", label: "Weavl Agent", icon: Bot },
  { href: "/home", label: "首页", icon: LayoutGrid },
  { href: "/projects", label: "项目", icon: Layers },
  { href: "/market", label: "市场", icon: ShoppingBag },
  { href: "/workflows", label: "工作流", icon: Workflow },
  { href: "/assets", label: "资产", icon: FolderOpen },
] as const;
const SIDEBAR_STATE_KEY = "weavl:sidebar-state";
const SIDEBAR_NARROW_QUERY = "(max-width: 1180px)";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAgentPage = pathname === "/agent" || pathname.startsWith("/agent/");
  const { user, loading } = useAuth();
  const { account } = useAccount();
  const [collapsed, setCollapsed] = useState(false);
  const [sidebarReady, setSidebarReady] = useState(false);

  useLayoutEffect(() => {
    const narrow = window.matchMedia(SIDEBAR_NARROW_QUERY);
    const saved = sessionStorage.getItem(SIDEBAR_STATE_KEY);
    setSidebarReady(false);
    // Agent 需要更宽的对话区域；只在进入页面时自动收起，不覆盖其他页面的侧栏偏好。
    setCollapsed(isAgentPage || (saved?.startsWith(`${narrow.matches}:`) ? saved.endsWith(":true") : narrow.matches));
    // 等收起状态完成首帧绘制后再启用过渡，避免切换页面时播放一次收起动画。
    let readyFrame = 0;
    const paintFrame = requestAnimationFrame(() => {
      readyFrame = requestAnimationFrame(() => setSidebarReady(true));
    });
    const syncSidebar = () => {
      setCollapsed(isAgentPage || narrow.matches);
      sessionStorage.setItem(SIDEBAR_STATE_KEY, `${narrow.matches}:${narrow.matches}`);
    };
    narrow.addEventListener("change", syncSidebar);
    return () => {
      cancelAnimationFrame(paintFrame);
      cancelAnimationFrame(readyFrame);
      narrow.removeEventListener("change", syncSidebar);
    };
  }, [isAgentPage]);

  const setSidebarCollapsed = (next: boolean) => {
    setCollapsed(next);
    sessionStorage.setItem(SIDEBAR_STATE_KEY, `${window.matchMedia(SIDEBAR_NARROW_QUERY).matches}:${next}`);
  };
  const loginLink = (
    <Link href="/login" className={styles.navItem} aria-label={collapsed ? "登录" : undefined}>
      <LogIn size={16} />
      {!collapsed && <span>登录</span>}
    </Link>
  );

  return (
    <div className={styles.shell}>
      {/* ============ 左侧栏（通天） ============ */}
      <aside
        className={`${styles.sider} ${collapsed ? styles.collapsed : ""} ${sidebarReady ? styles.siderReady : ""}`}
      >
        <div className={styles.siderTop}>
          {/* 品牌行：logo + 标题 + 常显收起按钮 */}
          {collapsed ? (
            // 收起后先提示展开操作，随后恢复品牌图标；整个按钮均可悬停展开。
            <button
              className={styles.logoSlot}
              onClick={() => setSidebarCollapsed(false)}
              title="展开侧栏"
              aria-label="展开侧栏"
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
              <WeavlBrand className={styles.brand} />
              <button className={styles.collapseBtn} onClick={() => setSidebarCollapsed(true)} title="收起侧栏">
                <PanelLeftClose size={16} />
              </button>
            </div>
          )}

          {/* 主导航 */}
          <nav className={styles.nav}>
            {NAV_ITEMS.map((item) => {
              const active =
                pathname === item.href ||
                (item.href === "/workflows" && (pathname === "/workflow" || pathname.startsWith("/preset")));
              const Icon = item.icon;
              const navLink = (
                <Link
                  href={item.href}
                  aria-label={collapsed ? item.label : undefined}
                  className={`${styles.navItem} ${active ? styles.active : ""}`}
                >
                  <Icon size={16} />
                  {!collapsed && <span className={styles.navLabel}>{item.label}</span>}
                </Link>
              );
              return (
                <Fragment key={item.href}>
                  {collapsed ? (
                    <Popover
                      mode="hover"
                      trigger={navLink}
                      side="right"
                      sideOffset={10}
                      showArrow={false}
                      contentClassName={styles.navPopover}
                    >
                      {item.label}
                    </Popover>
                  ) : (
                    navLink
                  )}
                  {item.href === "/agent" && <div className={styles.navDivider} role="separator" />}
                </Fragment>
              );
            })}
          </nav>
        </div>

        {!loading && (
          <div className={styles.siderBottom}>
            {user ? (
              <UserMenu
                side={collapsed ? "right" : "top"}
                align={collapsed ? "end" : "start"}
                trigger={
                  <SidebarAccountTrigger
                    credits={account?.credits ?? 0}
                    plan={account?.plan ?? "Free"}
                    collapsed={collapsed}
                    aria-label="用户菜单"
                  />
                }
              />
            ) : collapsed ? (
              <Popover
                mode="hover"
                trigger={loginLink}
                side="right"
                sideOffset={10}
                showArrow={false}
                contentClassName={styles.navPopover}
              >
                登录
              </Popover>
            ) : (
              loginLink
            )}
          </div>
        )}
      </aside>

      {/* ============ 右侧内容 ============ */}
      <div className={styles.right}>
        <main className={styles.main}>{children}</main>
      </div>
    </div>
  );
}
