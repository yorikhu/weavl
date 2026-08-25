"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Bot,
  Heart,
  ImageIcon,
  Layers,
  Play,
  Sparkles,
  Video,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";

const QUICK_STARTS = [
  { title: "图片生成", desc: "AI 智能生成精美图片", icon: ImageIcon, href: "/preset" },
  { title: "视频生成", desc: "AI 智能生成视频", icon: Video, href: "/preset" },
  { title: "画布创作", desc: "可视化工作流创作", icon: Layers, href: "/canvas" },
  { title: "Agent 对话", desc: "与 AI 助手对话创作", icon: Bot, href: "/agent" },
] as const;

const GALLERY = [
  { title: "星尘之旅", author: "织光创作者", likes: 128 },
  { title: "梦境花园", author: "AI 艺术家", likes: 256 },
  { title: "未来城市", author: "数字设计师", likes: 189 },
  { title: "光影诗篇", author: "视觉艺术家", likes: 167 },
  { title: "机械之心", author: "概念设计师", likes: 203 },
] as const;

const MY_WORKS = [
  { name: "法式穿搭大片 01", type: "图片", date: "今天" },
  { name: "夏日海边宣传片", type: "视频", date: "昨天" },
  { name: "国风水墨动画分镜", type: "视频", date: "3天前" },
  { name: "赛博朋克夜景渲染", type: "图片", date: "5天前" },
  { name: "极简产品海报编排", type: "预设", date: "上周" },
  { name: "电商主图批量流水线", type: "画布", date: "2周前" },
] as const;

export default function HomePage() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");

  return (
    <AppShell>
      <div className="mx-auto max-w-[1400px] space-y-7">
        {/* Hero：问候 + 提示输入条 + 快捷标签 */}
        <section className="relative flex flex-col justify-between overflow-hidden rounded-3xl border border-border bg-card p-7">
          <div className="relative z-10 space-y-1">
            <h1 className="text-xl font-bold tracking-tight">你好，织光师</h1>
            <p className="text-xs text-muted-foreground">
              今天想创造点什么呢？让灵感流动，让想象发光。
            </p>
          </div>

          <div className="relative z-10 mt-8 space-y-3">
            <div className="relative">
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && prompt && router.push("/preset")}
                placeholder="描述你的想法，按 Enter 生成"
                className="w-full rounded-2xl border border-[var(--input-border)] bg-[var(--input)] py-3.5 pr-12 pl-4 text-xs transition-all outline-none focus:ring-1 focus:ring-border-strong"
              />
              <button
                onClick={() => prompt && router.push("/preset")}
                className="absolute top-1/2 right-3 -translate-y-1/2 rounded-lg p-1.5 text-muted-foreground transition-colors hover:text-[var(--foreground)]"
              >
                <Sparkles className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              {[
                { label: "生成图片", icon: ImageIcon, href: "/preset" },
                { label: "生成视频", icon: Video, href: "/preset" },
                { label: "从预设开始", icon: Layers, href: "/preset" },
                { label: "打开画布", icon: Layers, href: "/canvas" },
                { label: "Agent 对话", icon: Bot, href: "/agent" },
              ].map((tag) => (
                <button
                  key={tag.label}
                  onClick={() => router.push(tag.href)}
                  className="flex items-center gap-1.5 rounded-full border border-border bg-sub-card px-3 py-1.5 text-[11px] font-medium text-muted-foreground transition-all hover:border-border-strong hover:text-[var(--foreground)]"
                >
                  <tag.icon className="h-3 w-3" />
                  {tag.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* 快捷开始 */}
        <section className="space-y-3">
          <h3 className="text-xs font-bold">快捷开始</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {QUICK_STARTS.map((item) => (
              <button
                key={item.title}
                onClick={() => router.push(item.href)}
                className="group flex items-center justify-between rounded-2xl border border-border bg-card p-4 text-left transition-all hover:border-border-strong hover:bg-card-hover"
              >
                <div className="space-y-1">
                  <h4 className="text-xs font-bold transition-colors group-hover:text-[var(--accent)]">
                    {item.title}
                  </h4>
                  <p className="text-[11px] text-muted-foreground">{item.desc}</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-sub-card transition-transform group-hover:scale-110">
                  <item.icon className="h-4 w-4 text-muted-foreground" />
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* 灵感广场 */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold">灵感广场</h3>
            <button className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-[var(--foreground)]">
              查看更多
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-5">
            {GALLERY.map((card) => (
              <div
                key={card.title}
                className="group flex flex-col cursor-pointer overflow-hidden rounded-2xl border border-border bg-card transition-all hover:border-border-strong hover:bg-card-hover"
              >
                <div className="relative flex h-28 items-center justify-center overflow-hidden bg-gradient-to-br from-slate-700 to-zinc-900 dark:from-slate-800 dark:to-zinc-950">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 backdrop-blur-md transition-transform group-hover:scale-110">
                    <Play className="h-3.5 w-3.5 text-white/70" />
                  </div>
                </div>
                <div className="flex flex-1 flex-col justify-between space-y-2 p-2.5">
                  <h4 className="truncate text-xs font-semibold">{card.title}</h4>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground">{card.author}</span>
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Heart className="h-2.5 w-2.5" />
                      {card.likes}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 我的创作 */}
        <section className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold">我的创作</h3>
            <button className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-[var(--foreground)]">
              全部作品
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {MY_WORKS.map((work) => (
              <div
                key={work.name}
                className="cursor-pointer rounded-2xl border border-border bg-card p-3 transition-all hover:border-border-strong hover:bg-card-hover"
              >
                <div className="mb-2 flex h-20 items-center justify-center rounded-xl bg-gradient-to-tr from-stone-700 to-zinc-600 dark:from-stone-800 dark:to-zinc-800">
                  <Sparkles className="h-4 w-4 text-white/50" />
                </div>
                <h5 className="truncate text-xs font-medium">{work.name}</h5>
                <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>{work.type}</span>
                  <span>{work.date}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
