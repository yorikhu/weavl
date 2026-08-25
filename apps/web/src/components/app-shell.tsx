"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Bot,
  Bookmark,
  Heart,
  LayoutGrid,
  Layers,
  Moon,
  ShoppingBag,
  Sun,
  Trash2,
  User,
  Wand2,
} from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { CreditsBadge } from "@/components/credits-badge";
import { StarburstLogo } from "@/components/starburst-logo";

const NAV_ITEMS = [
  { href: "/", label: "首页", icon: LayoutGrid },
  { href: "/canvas", label: "画布", icon: LayoutGrid },
  { href: "/agent", label: "Agent 对话", icon: Bot },
  { href: "/market", label: "市场", icon: ShoppingBag },
  { href: "/preset", label: "预设", icon: Layers },
] as const;

const MY_SPACE_ITEMS = [
  { label: "我的预设", icon: Wand2 },
  { label: "我的作品", icon: Bookmark },
  { label: "我的收藏", icon: Heart },
  { label: "回收站", icon: Trash2 },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const { theme, toggle } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const isDark = theme === "dark";

  return (
    <div className="flex h-screen flex-col font-sans antialiased">
      {/* 顶栏：品牌 + 积分 + 主题切换 + 头像 */}
      <header className="frost-header z-50 flex h-16 shrink-0 items-center justify-between border-b border-border px-6">
        <button
          onClick={() => router.push("/")}
          className="group flex items-center gap-3"
        >
          <StarburstLogo className="h-7 w-7" />
          <span className="flex items-baseline gap-2 select-none">
            <span className="text-lg font-semibold tracking-tight">Weavl</span>
            <span className="text-sm font-normal text-muted-foreground">织光</span>
          </span>
        </button>

        <div className="flex items-center gap-3.5">
          <CreditsBadge amount={0} />
          <button
            onClick={toggle}
            title="切换深色/浅色主题"
            className="rounded-full border border-border bg-card p-2 transition-all hover:border-border-strong"
          >
            {isDark ? (
              <Sun className="h-4 w-4 text-[var(--accent)]" />
            ) : (
              <Moon className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
          <div className="relative cursor-pointer">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-slate-600 to-slate-400 text-white ring-2 ring-border">
              <User className="h-4 w-4" />
            </div>
            <div className="absolute right-0 bottom-0 h-2.5 w-2.5 rounded-full bg-[var(--success)] ring-2 ring-[var(--background)]" />
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* 左侧栏：主导航 + 我的空间 + Pro 卡片 */}
        <aside className="flex w-56 shrink-0 flex-col justify-between border-r border-border bg-[var(--sider)] p-4 select-none">
          <div className="space-y-6">
            <nav className="space-y-1">
              {NAV_ITEMS.map((item) => {
                const active = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium transition-all ${
                      active
                        ? "border border-border-strong bg-card text-[var(--card-foreground)] shadow-sm"
                        : "text-muted-foreground hover:bg-card-hover hover:text-[var(--foreground)]"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div>
              <p className="mb-2 px-3 text-[11px] font-semibold tracking-wider text-faint-foreground">
                我的空间
              </p>
              <div className="space-y-0.5">
                {MY_SPACE_ITEMS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.label}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs text-muted-foreground transition-all hover:bg-card-hover hover:text-[var(--foreground)]"
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Pro 卡片 */}
          <div className="rounded-2xl border border-border bg-card p-3.5">
            <div className="mb-1.5 flex items-center gap-1.5">
              <span className="text-xs font-bold">织光 Pro 会员</span>
              <span className="rounded-full border border-[var(--accent-soft)] bg-[var(--accent-soft)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--accent)]">
                Pro
              </span>
            </div>
            <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground">
              解锁更多高级功能与算力
            </p>
            <button className="w-full rounded-xl border border-border-strong bg-[var(--foreground)] py-2 text-xs font-medium text-[var(--background)] transition-all hover:opacity-90">
              升级会员
            </button>
          </div>
        </aside>

        {/* 主内容区 */}
        <main className="flex-1 overflow-y-auto px-7 py-6">{children}</main>
      </div>
    </div>
  );
}
