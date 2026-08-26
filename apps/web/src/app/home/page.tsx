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
  Wand2,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import styles from "./page.module.scss";

const QUICK_STARTS = [
  {
    title: "图片生成",
    desc: "AI 智能生成精美图片",
    icon: ImageIcon,
    href: "/preset",
  },
  { title: "视频生成", desc: "AI 智能生成视频", icon: Video, href: "/preset" },
  {
    title: "画布创作",
    desc: "可视化工作流创作",
    icon: Layers,
    href: "/projects",
  },
  {
    title: "Agent 对话",
    desc: "与 AI 助手对话创作",
    icon: Bot,
    href: "/agent",
  },
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
      <div className={styles.container}>
        {/* Hero */}
        <section className={styles.hero}>
          <div className={styles.heroIntro}>
            <h1 className={styles.heroTitle}>你好，织光师</h1>
            <p className={styles.heroSub}>
              今天想创造点什么呢？让灵感流动，让想象发光。
            </p>
          </div>

          <div>
            <div className={styles.promptWrap}>
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && prompt && router.push("/preset")
                }
                placeholder="描述你的想法，按 Enter 生成"
                className={styles.promptInput}
              />
              <button
                onClick={() => prompt && router.push("/preset")}
                className={styles.promptBtn}
                aria-label="生成"
              >
                <Sparkles size={16} />
              </button>
            </div>

            <div className={styles.quickTags}>
              {[
                { label: "生成图片", icon: ImageIcon, href: "/preset" },
                { label: "生成视频", icon: Video, href: "/preset" },
                { label: "从预设开始", icon: Wand2, href: "/preset" },
                { label: "打开项目", icon: Layers, href: "/projects" },
                { label: "Agent 对话", icon: Bot, href: "/agent" },
              ].map((tag) => (
                <button
                  key={tag.label}
                  onClick={() => router.push(tag.href)}
                  className={styles.tag}
                >
                  <tag.icon size={12} />
                  {tag.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* 快捷开始 */}
        <section>
          <div className={styles.sectionHead}>
            <h3 className={styles.sectionTitle}>快捷开始</h3>
          </div>
          <div className={styles.quickGrid}>
            {QUICK_STARTS.map((item) => (
              <button
                key={item.title}
                onClick={() => router.push(item.href)}
                className={styles.quickCard}
              >
                <div className={styles.quickInfo}>
                  <h4 className={styles.quickTitle}>{item.title}</h4>
                  <p className={styles.quickDesc}>{item.desc}</p>
                </div>
                <span className={styles.quickIcon}>
                  <item.icon size={16} />
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* 灵感广场 */}
        <section>
          <div className={styles.sectionHead}>
            <h3 className={styles.sectionTitle}>灵感广场</h3>
            <button className={styles.moreLink}>
              查看更多 <ArrowRight size={12} />
            </button>
          </div>
          <div className={styles.galleryGrid}>
            {GALLERY.map((card) => (
              <div key={card.title} className={styles.galleryCard}>
                <div className={styles.galleryCover}>
                  <span className={styles.galleryPlay}>
                    <Play size={14} />
                  </span>
                </div>
                <div className={styles.galleryBody}>
                  <h4 className={styles.galleryTitle}>{card.title}</h4>
                  <div className={styles.galleryMeta}>
                    <span>{card.author}</span>
                    <span className={styles.galleryLikes}>
                      <Heart size={10} />
                      {card.likes}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 我的创作 */}
        <section>
          <div className={styles.sectionHead}>
            <h3 className={styles.sectionTitle}>我的创作</h3>
            <button className={styles.moreLink}>
              全部作品 <ArrowRight size={12} />
            </button>
          </div>
          <div className={styles.worksGrid}>
            {MY_WORKS.map((work) => (
              <div key={work.name} className={styles.workCard}>
                <div className={styles.workCover}>
                  <Sparkles size={16} />
                </div>
                <h5 className={styles.workName}>{work.name}</h5>
                <div className={styles.workMeta}>
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
