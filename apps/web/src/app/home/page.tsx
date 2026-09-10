"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ArrowUp,
  Bot,
  BrainCircuit,
  Check,
  Clock,
  Cpu,
  Images,
  Layers,
  Plus,
  SlidersHorizontal,
  Sparkles,
  Upload,
  Workflow,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Popover } from "@/components/Popover";
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

interface PromptChoice {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
}

type PromptMenu = "model" | "skill" | "mode";

const MODEL_OPTIONS: PromptChoice[] = [
  { id: "auto", label: "智能选择", description: "根据任务自动匹配合适模型", icon: Sparkles },
  { id: "quality", label: "高质量模型", description: "优先复杂推理与生成质量", icon: Cpu },
  { id: "fast", label: "快速模型", description: "优先响应速度与轻量任务", icon: Bot },
];

const SKILL_OPTIONS: PromptChoice[] = [
  { id: "auto", label: "自动匹配 Skill", description: "根据输入自动加载专业能力", icon: Sparkles },
  { id: "visual", label: "视觉创作", description: "图像、设计与视觉内容生成", icon: Images },
  { id: "workflow", label: "工作流编排", description: "拆解任务并连接多个执行步骤", icon: Workflow },
];

const MODE_OPTIONS: PromptChoice[] = [
  { id: "workflow", label: "工作流模式", description: "生成可继续编辑的完整工作流", icon: Workflow },
  { id: "direct", label: "直接生成", description: "跳过编排，直接生成最终内容", icon: Sparkles },
  { id: "plan", label: "仅规划", description: "先输出结构和执行计划", icon: Layers },
];

interface PromptChoicePopoverProps {
  label: string;
  hint: string;
  icon: LucideIcon;
  options: PromptChoice[];
  selected: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (id: string) => void;
}

function PromptChoicePopover({
  label,
  hint,
  icon: TriggerIcon,
  options,
  selected,
  open,
  onOpenChange,
  onSelect,
}: PromptChoicePopoverProps) {
  return (
    <Popover
      mode="click"
      open={open}
      onOpenChange={onOpenChange}
      side="top"
      align="center"
      sideOffset={10}
      ariaLabel={label}
      contentRole="menu"
      contentClassName={styles.attachmentPopover}
      hint={hint}
      hintAlign="center"
      preserveOpenOnOutsideSelector="[data-prompt-popover-trigger]"
      trigger={
        <button
          type="button"
          className={styles.promptIconButton}
          aria-label={label}
          data-prompt-popover-trigger
        >
          <TriggerIcon size={14} />
        </button>
      }
    >
      {options.map((option) => {
        const OptionIcon = option.icon;
        return (
          <button
            key={option.id}
            type="button"
            className={styles.attachmentOption}
            role="menuitemradio"
            aria-checked={selected === option.id}
            onClick={() => onSelect(option.id)}
          >
            <span className={styles.attachmentOptionIcon}>
              <OptionIcon size={15} />
            </span>
            <span>
              <strong>{option.label}</strong>
              <small>{option.description}</small>
            </span>
            {selected === option.id && <Check size={14} className={styles.choiceCheck} />}
          </button>
        );
      })}
    </Popover>
  );
}

export default function HomePage() {
  const router = useRouter();
  const { theme } = useTheme();
  const [prompt, setPrompt] = useState("");
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
  const [attachmentComposerExpanded, setAttachmentComposerExpanded] = useState(false);
  const [activePromptMenu, setActivePromptMenu] = useState<PromptMenu | null>(null);
  const [selectedModel, setSelectedModel] = useState("auto");
  const [selectedSkill, setSelectedSkill] = useState("auto");
  const [selectedMode, setSelectedMode] = useState("workflow");
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const promptInputRef = useRef<HTMLTextAreaElement>(null);
  const promptBarRef = useRef<HTMLDivElement>(null);
  const attachmentExpandTimerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (attachmentExpandTimerRef.current !== null) window.clearTimeout(attachmentExpandTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    const handleOutsidePointerDown = (event: PointerEvent) => {
      if (prompt.trim()) return;

      const target = event.target;
      if (!(target instanceof Node) || promptBarRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest(`.${styles.attachmentPopover}`)) return;

      setAttachmentComposerExpanded(false);
    };

    document.addEventListener("pointerdown", handleOutsidePointerDown);
    return () => document.removeEventListener("pointerdown", handleOutsidePointerDown);
  }, [prompt]);

  const handleAttachmentMenuOpenChange = (open: boolean) => {
    if (attachmentExpandTimerRef.current !== null) {
      window.clearTimeout(attachmentExpandTimerRef.current);
      attachmentExpandTimerRef.current = null;
    }

    setAttachmentMenuOpen(open);
    if (!open) {
      return;
    }

    setActivePromptMenu(null);

    if (prompt || document.activeElement === promptInputRef.current) {
      setAttachmentComposerExpanded(true);
      return;
    }

    attachmentExpandTimerRef.current = window.setTimeout(() => {
      setAttachmentComposerExpanded(true);
      attachmentExpandTimerRef.current = null;
    }, 90);
  };

  const handlePromptMenuOpenChange = (menu: PromptMenu, open: boolean) => {
    setActivePromptMenu((currentMenu) => {
      if (open) return menu;
      return currentMenu === menu ? null : currentMenu;
    });

    if (open) setAttachmentMenuOpen(false);
  };

  const openLocalAttachmentPicker = () => {
    if (attachmentExpandTimerRef.current !== null) {
      window.clearTimeout(attachmentExpandTimerRef.current);
      attachmentExpandTimerRef.current = null;
    }

    setAttachmentMenuOpen(false);
    setAttachmentComposerExpanded(true);

    const input = attachmentInputRef.current;
    if (input) {
      input.value = "";
      input.click();
    }
  };

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
              backgroundColor={theme === "dark" ? "#161618" : "#F5F1FF"}
              shardColor={theme === "dark" ? "#696973" : "#5ED7E5"}
              accentColor={theme === "dark" ? "#E4E4E7" : "#7C5CFC"}
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
          <div
            ref={promptBarRef}
            className={`${styles.promptBar} ${
              prompt || attachmentComposerExpanded || activePromptMenu ? styles.promptBarActive : ""
            }`}
          >
            <input
              ref={attachmentInputRef}
              className={styles.attachmentInput}
              type="file"
              multiple
              onChange={() => setAttachmentComposerExpanded(true)}
            />
            <Popover
              mode="click"
              open={attachmentMenuOpen}
              onOpenChange={handleAttachmentMenuOpenChange}
              side="top"
              align="start"
              sideOffset={10}
              ariaLabel="添加附件"
              contentRole="menu"
              contentClassName={styles.attachmentPopover}
              hint="添加附件"
              hintAlign="center"
              preserveOpenOnOutsideSelector="[data-prompt-popover-trigger]"
              autoFocusOnOpen={false}
              trigger={
                <button
                  type="button"
                  className={`${styles.promptIconButton} ${styles.promptPlus}`}
                  aria-label="添加附件"
                  data-prompt-popover-trigger
                  onMouseDown={(event) => event.preventDefault()}
                >
                  <Plus size={15} />
                </button>
              }
            >
              <button
                type="button"
                className={styles.attachmentOption}
                role="menuitem"
                onClick={openLocalAttachmentPicker}
              >
                <span className={styles.attachmentOptionIcon}>
                  <Upload size={15} />
                </span>
                <span>
                  <strong>从本地添加</strong>
                  <small>从本地选择图片、视频或文档</small>
                </span>
              </button>
              <button
                type="button"
                className={styles.attachmentOption}
                role="menuitem"
                onClick={() => handleAttachmentMenuOpenChange(false)}
              >
                <span className={styles.attachmentOptionIcon}>
                  <Images size={15} />
                </span>
                <span>
                  <strong>从素材库添加</strong>
                  <small>选择已保存到空间的素材</small>
                </span>
              </button>
            </Popover>
            <textarea
              ref={promptInputRef}
              rows={1}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  startAgent();
                }
              }}
              placeholder="帮我做一支古风穿搭种草视频，从脚本到成片…"
              className={styles.promptInput}
            />
            <div className={styles.promptOptions} aria-label="生成选项">
              <PromptChoicePopover
                label="选择模型"
                hint="选择模型"
                icon={BrainCircuit}
                options={MODEL_OPTIONS}
                selected={selectedModel}
                open={activePromptMenu === "model"}
                onOpenChange={(open) => handlePromptMenuOpenChange("model", open)}
                onSelect={(id) => {
                  setSelectedModel(id);
                  setActivePromptMenu(null);
                }}
              />
              <PromptChoicePopover
                label="选择 Skill"
                hint="选择 Skill"
                icon={Sparkles}
                options={SKILL_OPTIONS}
                selected={selectedSkill}
                open={activePromptMenu === "skill"}
                onOpenChange={(open) => handlePromptMenuOpenChange("skill", open)}
                onSelect={(id) => {
                  setSelectedSkill(id);
                  setActivePromptMenu(null);
                }}
              />
              <PromptChoicePopover
                label="选择生成模式"
                hint="选择生成模式"
                icon={SlidersHorizontal}
                options={MODE_OPTIONS}
                selected={selectedMode}
                open={activePromptMenu === "mode"}
                onOpenChange={(open) => handlePromptMenuOpenChange("mode", open)}
                onSelect={(id) => {
                  setSelectedMode(id);
                  setActivePromptMenu(null);
                }}
              />
            </div>
            <button
              type="button"
              className={`${styles.promptIconButton} ${styles.promptGo}`}
              aria-label="开始创作"
              disabled={!prompt.trim()}
              onClick={startAgent}
            >
              <ArrowUp size={15} />
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
