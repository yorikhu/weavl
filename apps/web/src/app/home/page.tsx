"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { ArrowRight, Bot, Clock, Layers, Plus, Workflow } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useTheme } from "@/provider/ThemeProvider";
import styles from "./page.module.scss";

const AeroShards = dynamic(() => import("@/components/AeroShards"), { ssr: false });

/* 工作流模板（mock，后续接 templates API） */
const TEMPLATES = [
  {
    name: "小红书种草图文",
    desc: "6 节点 · 选题→封面→正文",
    tag: "图文",
    uses: "12.4k",
    flow: ["llm", "image", "output"] as const,
  },
  {
    name: "电商主图流水线",
    desc: "4 节点 · 批量出图",
    tag: "图片",
    uses: "8.2k",
    flow: ["llm", "image"] as const,
  },
  {
    name: "短剧分镜工作台",
    desc: "8 节点 · 分支剧情",
    tag: "视频",
    uses: "6.7k",
    flow: ["llm", "output", "image", "llm"] as const,
  },
  {
    name: "古风视频成片",
    desc: "5 节点 · 脚本→配音→成片",
    tag: "视频",
    uses: "5.1k",
    flow: ["image", "output"] as const,
  },
] as const;

/* 节点色（与画布 KIND_META 对齐） */
const FLOW_COLORS: Record<string, string> = {
  llm: "#d44b7e",
  image: "#d4537e",
  output: "#f59e0b",
};

/* 最近画布（mock，后续接 projects API） */
const RECENT = [
  { name: "法式穿搭大片", meta: "3 分钟前编辑 · 6 节点", flow: ["image", "video", "output"] },
  { name: "夏日海边宣传片", meta: "昨天编辑 · 4 节点", flow: ["video", "output"] },
  { name: "国风水墨分镜", meta: "3 天前编辑 · 8 节点", flow: ["llm", "output", "video", "llm"] },
] as const;

/* 我的 Agent（mock） */
const MY_AGENTS = [
  { name: "种草文案手", runs: 23, hue: "#534ab7" },
  { name: "分镜师", runs: 11, hue: "#0F6E56" },
] as const;

const HOT_TAGS = ["古风视频", "电商主图", "小红书图文", "短剧分镜"] as const;

export default function HomePage() {
  const router = useRouter();
  const { theme } = useTheme();
  const [prompt, setPrompt] = useState("");

  /* Hero 提交：带 prompt 进画布并自动唤起 Agent */
  const startAgent = () => {
    const q = prompt.trim();
    if (q) {
      sessionStorage.setItem("weavl:agent-prompt", q);
      router.push("/canvas?agent=1");
    } else {
      router.push("/canvas");
    }
  };

  return (
    <AppShell>
      <div className={styles.container}>
        {/* ---- Hero：Agent 主入口 ---- */}
        <section className={styles.hero}>
          <div className={styles.aeroLayer}>
            <AeroShards
              backgroundColor={theme === "dark" ? "#161618" : "#FFFFFF"}
              shardColor={theme === "dark" ? "#696973" : "#C2C7D0"}
              accentColor={theme === "dark" ? "#E4E4E7" : "#59606B"}
              placement="full"
              flow="stream"
              material="pearl"
              detail="balanced"
              effect="none"
              scale={1}
              spread={1}
              depth={1}
              speed={1}
              spin={1}
              interaction="repel"
              density={1.5}
              shardSize={1.1}
              stretch={1}
              turbulence={1}
              glow={1}
              edgeSoftness={2}
              bloom={0.5}
              grain={0.05}
              chromaticAberration={0.0075}
              transitionDuration={1}
              interactionRadius={1.5}
              interactionStrength={0.5}
              rippleIntensity={1}
              holdToGather
              onError={undefined}
            />
          </div>
          <h1 className={styles.heroTitle}>你好，织光师</h1>
          <p className={styles.heroSub}>描述你想做的事，Agent 为你编排画布工作流</p>
          <div className={styles.promptBar}>
            <span className={styles.promptBotIcon}>
              <Bot size={14} />
            </span>
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && startAgent()}
              placeholder="帮我做一支古风穿搭种草视频，从脚本到成片…"
              className={styles.promptInput}
            />
            <button className={styles.promptPlus} title="添加参考素材" aria-label="添加参考素材">
              <Plus size={13} />
            </button>
            <button className={styles.promptGo} onClick={startAgent}>
              开始创作
            </button>
          </div>
          <div className={styles.hotTags}>
            {HOT_TAGS.map((t) => (
              <button
                key={t}
                className={styles.hotTag}
                onClick={() => {
                  setPrompt(`帮我做${t}相关内容`);
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </section>

        {/* ---- 三入口卡 ---- */}
        <section className={styles.entries}>
          <button className={`${styles.entryCard} ${styles.entryCardPrimary}`} onClick={() => router.push("/canvas")}>
            <span className={styles.entryIconPrimary}>
              <Workflow size={16} />
            </span>
            <span className={styles.entryTexts}>
              <span className={styles.entryTitle}>新建空白画布</span>
              <span className={styles.entryDesc}>从零搭建你的工作流 · 空画布起步</span>
            </span>
            <ArrowRight size={15} className={styles.entryArrow} />
          </button>
          <button className={styles.entryCard} onClick={() => router.push("/agent")}>
            <span className={styles.entryIcon}>
              <Bot size={14} />
            </span>
            <span className={styles.entryTexts}>
              <span className={styles.entryTitle}>找 Agent</span>
              <span className={styles.entryDesc}>对话式创建</span>
            </span>
          </button>
          <button className={styles.entryCard} onClick={() => router.push("/projects")}>
            <span className={styles.entryIcon}>
              <Layers size={14} />
            </span>
            <span className={styles.entryTexts}>
              <span className={styles.entryTitle}>导入工作流</span>
              <span className={styles.entryDesc}>JSON / 模板文件</span>
            </span>
          </button>
        </section>

        {/* ---- 工作流模板 ---- */}
        <section>
          <div className={styles.sectionHead}>
            <h3 className={styles.sectionTitle}>
              工作流模板
              <span className={styles.sectionBadge}>新品</span>
            </h3>
            <button className={styles.moreLink}>
              全部模板 <ArrowRight size={11} />
            </button>
          </div>
          <div className={styles.tplGrid}>
            {TEMPLATES.map((tpl) => (
              <button
                key={tpl.name}
                className={styles.tplCard}
                onClick={() => router.push(`/preset/detail?id=${encodeURIComponent(tpl.name)}`)}
              >
                <div className={styles.tplCover}>
                  <span className={styles.tplFlow}>
                    {tpl.flow.map((kind, i) => (
                      <span key={i} className={styles.tplFlowWrap}>
                        {i > 0 && <span className={styles.tplFlowLine}>──▶</span>}
                        <span
                          className={styles.tplFlowNode}
                          style={{ background: `${FLOW_COLORS[kind]}55`, borderColor: `${FLOW_COLORS[kind]}70` }}
                        />
                      </span>
                    ))}
                  </span>
                </div>
                <div className={styles.tplBody}>
                  <h4 className={styles.tplName}>{tpl.name}</h4>
                  <p className={styles.tplDesc}>{tpl.desc}</p>
                  <div className={styles.tplMeta}>
                    <span className={styles.tplTag}>{tpl.tag}</span>
                    <span className={styles.tplUses}>{tpl.uses} 使用</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* ---- 最近画布 + 我的 Agent ---- */}
        <section className={styles.bottomSplit}>
          <div className={styles.recentCol}>
            <div className={styles.sectionHead}>
              <h3 className={styles.sectionTitle}>最近画布</h3>
              <button className={styles.moreLink} onClick={() => router.push("/projects")}>
                全部项目 <ArrowRight size={11} />
              </button>
            </div>
            <div className={styles.recentList}>
              {RECENT.map((r) => (
                <button key={r.name} className={styles.recentRow} onClick={() => router.push("/canvas")}>
                  <span className={styles.recentThumb}>
                    {r.flow.map((kind, i) => (
                      <span key={i} className={styles.recentNode} style={{ background: `${FLOW_COLORS[kind]}66` }} />
                    ))}
                  </span>
                  <span className={styles.recentTexts}>
                    <span className={styles.recentName}>{r.name}</span>
                    <span className={styles.recentMeta}>
                      <Clock size={9} />
                      {r.meta}
                    </span>
                  </span>
                  <span className={styles.recentGo}>继续编辑</span>
                </button>
              ))}
            </div>
          </div>

          <div className={styles.agentCol}>
            <div className={styles.sectionHead}>
              <h3 className={styles.sectionTitle}>我的 Agent</h3>
              <button className={styles.moreLink}>
                管理 <ArrowRight size={11} />
              </button>
            </div>
            <div className={styles.agentGrid}>
              {MY_AGENTS.map((a) => (
                <button key={a.name} className={styles.agentCard}>
                  <span
                    className={styles.agentAvatar}
                    style={{ background: `linear-gradient(135deg, ${a.hue}, ${a.hue}cc)` }}
                  >
                    {a.name.slice(0, 1)}
                  </span>
                  <span className={styles.agentName}>{a.name}</span>
                  <span className={styles.agentRuns}>运行 {a.runs} 次</span>
                </button>
              ))}
              <button className={styles.agentCardAdd}>
                <span className={styles.agentAddIcon}>
                  <Plus size={13} />
                </span>
                <span className={styles.agentAddText}>创建 Agent</span>
              </button>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
