"use client";

import { memo, useEffect, useLayoutEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowUp, AudioLines, Bot, Box, Check, Clapperboard, FileText, FolderOpen, Image, LayoutGrid, Paperclip, Settings2, ShoppingBag, UserRound, Wrench, Workflow } from "lucide-react";
import type { Asset, MarketEntry } from "@weavl/shared";
import { AppShell } from "@/components/AppShell";
import { ActionPopover } from "@/components/ActionPopover";
import { AbilityCard } from "./components/AbilityCard";
import { InlineComposer, type InlineComposerHandle } from "@/components/InlineComposer";
import GlareHover from "@/components/GlareHover";
import { studioApi } from "@/lib/studioApi";
import { useAuth } from "@/provider/AuthProvider";
import { useTheme } from "@/provider/ThemeProvider";
import { uploadAsset } from "@/utils/uploadAsset";
import { createTiltCardHandlers } from "@/utils/tiltCard";
import styles from "./page.module.scss";

const examples = ["把访谈资料整理成 IP 定位", "根据产品资料写一版脚本", "梳理一周进度形成周报"];
const AeroShards = memo(dynamic(() => import("@/components/AeroShards"), { ssr: false }));
const heroTiltHandlers = createTiltCardHandlers<HTMLDivElement>(6);
const models = [
  { id: "text", label: "文本模型", detail: "文案、策划、结构化内容", icon: FileText },
  { id: "image", label: "图片模型", detail: "视觉概念与图片生成", icon: Image },
  { id: "video", label: "视频模型", detail: "分镜与视频生成", icon: Clapperboard },
  { id: "audio", label: "音频模型", detail: "配音、音乐与音效", icon: AudioLines },
  { id: "avatar", label: "数字人模型", detail: "形象与口播内容", icon: UserRound },
] as const;
type ModelKind = (typeof models)[number]["id"];
const composerTools = [
  { id: "attachments", label: "插入附件", icon: Paperclip },
  { id: "model", label: "插入模型", icon: Box },
  { id: "skill", label: "插入 Skill", icon: Wrench },
  { id: "mode", label: "选择模式", icon: Settings2 },
] as const;
type ComposerTool = (typeof composerTools)[number]["id"];
type CreationMode = "manual" | "auto";
function removeFirst<T>(items: T[], value: T): T[] {
  const index = items.indexOf(value);
  return index < 0 ? items : items.filter((_, itemIndex) => itemIndex !== index);
}
const abilities = [
  { title: "对话创作", desc: "让每个念头，在对话中渐渐成形。", href: "/agent", icon: Bot, number: "01", artwork: "agent" },
  {
    title: "项目画布",
    desc: "素材与思路，在画布上有序生长。",
    href: "/projects",
    icon: LayoutGrid,
    number: "02",
    artwork: "canvas",
  },
  { title: "技能市场", desc: "让好方法被发现，也被更多人沿用。", href: "/market", icon: ShoppingBag, number: "03", artwork: "skill" },
  {
    title: "工作流",
    desc: "一键复用，重复的工作不再重复。",
    href: "/workflows",
    icon: Workflow,
    number: "04",
    artwork: "workflow",
  },
  {
    title: "共享资产",
    desc: "让资料与作品，始终有处可归。",
    href: "/assets",
    icon: FolderOpen,
    number: "05",
    artwork: "assets",
  },
] as const;
const capabilities = [
  { name: "文本与结构化内容", status: "本地模拟可用", desc: "对话草稿、定位、脚本与周报" },
  { name: "图像、视频与音频", status: "待接入模型", desc: "资产可上传、预览与引用；生成服务尚未接入" },
  { name: "Word、PPT 与 PDF", status: "文件管理可用", desc: "支持资产化与下载，专项生成随后接入" },
];

export default function HomePage() {
  const router = useRouter();
  const { user } = useAuth();
  const { theme } = useTheme();
  const [initialPrompt, setInitialPrompt] = useState("");
  const promptRef = useRef("");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [market, setMarket] = useState<MarketEntry[]>([]);
  const [assetIds, setAssetIds] = useState<string[]>([]);
  const [methodIds, setMethodIds] = useState<string[]>([]);
  const [modelKinds, setModelKinds] = useState<ModelKind[]>([]);
  const [mode, setMode] = useState<CreationMode>("auto");
  const [openTool, setOpenTool] = useState<ComposerTool | null>(null);
  const [toolSearch, setToolSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [composerError, setComposerError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<InlineComposerHandle>(null);
  const heroRef = useRef<HTMLElement>(null);
  const heroContentRef = useRef<HTMLDivElement>(null);
  const heroTitleRef = useRef<HTMLHeadingElement>(null);
  const heroDescriptionRef = useRef<HTMLParagraphElement>(null);
  const [hideHeroCard, setHideHeroCard] = useState(false);

  useLayoutEffect(() => {
    const hero = heroRef.current;
    const content = heroContentRef.current;
    const title = heroTitleRef.current;
    const description = heroDescriptionRef.current;
    if (!hero || !content || !title || !description) return;

    const updateCardVisibility = () => {
      const heroStyle = getComputedStyle(hero);
      const contentStyle = getComputedStyle(content);
      const gap = parseFloat(heroStyle.columnGap) || 0;
      const innerWidth = hero.clientWidth - gap;
      const cardMinWidth = 260;
      const contentColumnWidth = Math.min((innerWidth * 1.7) / 2.4, innerWidth - cardMinWidth);
      const textWidth =
        contentColumnWidth - parseFloat(contentStyle.paddingLeft) - parseFloat(contentStyle.paddingRight);
      setHideHeroCard(textWidth < Math.max(title.scrollWidth, description.scrollWidth) + 8);
    };

    const observer = new ResizeObserver(updateCardVisibility);
    observer.observe(hero);
    observer.observe(title);
    observer.observe(description);
    updateCardVisibility();
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!user) return;
    void Promise.all([
      studioApi<Asset[]>("/studio/assets"),
      studioApi<MarketEntry[]>("/studio/market"),
    ])
      .then(([files, methods]) => {
        setAssets(files);
        setMarket(methods);
      })
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    const saved = sessionStorage.getItem("weavl:home-draft");
    if (saved) {
      promptRef.current = saved;
      setInitialPrompt(saved);
      sessionStorage.removeItem("weavl:home-draft");
    }
  }, []);

  async function addFiles(files: FileList | null) {
    if (!files?.length || !user) return;
    setUploading(true);
    setComposerError("");
    try {
      for (const file of Array.from(files)) {
        const asset = await uploadAsset(file);
        setAssets((current) => [asset, ...current]);
        setAssetIds((current) => [...current, asset.id]);
        composerRef.current?.insertToken({ type: "asset", id: asset.id, label: asset.name });
      }
      setOpenTool(null);
    } catch (cause) {
      setComposerError((cause as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function openLogin() {
    if (promptRef.current) sessionStorage.setItem("weavl:home-draft", promptRef.current);
    router.push("/login?next=/home");
  }

  function begin(value = promptRef.current) {
    const text = value.trim();
    if (text || assetIds.length || methodIds.length || modelKinds.length) {
      sessionStorage.setItem(
        "weavl:agent-start",
        JSON.stringify({ prompt: text, assetIds, marketEntryIds: methodIds, modelKinds, auto: mode === "auto" && Boolean(text) }),
      );
    }
    router.push(user ? "/agent" : "/login?next=/agent");
  }

  function renderToolContent(tool: ComposerTool) {
    if (tool === "model") {
      return (
        <div className={styles.toolMenu}>
          <strong>插入模型</strong>
          <div className={styles.menuList}>
            {models.map((model) => {
              const Icon = model.icon;
              return (
                <button key={model.id} type="button" className={styles.menuItem} onClick={() => {
                  composerRef.current?.insertToken({ type: "model", id: model.id, label: model.label }, false);
                  setModelKinds((current) => [...current, model.id]);
                }}>
                  <Icon size={15} />
                  <span>{model.label}<small>{model.detail}</small></span>
                </button>
              );
            })}
          </div>
          <p>当前生成服务尚未接入；插入的模型会带入 Agent，结果为文字模拟稿。</p>
        </div>
      );
    }
    if (tool === "mode") {
      return (
        <div className={styles.toolMenu}>
          <strong>创作模式</strong>
          {([
            { id: "auto", title: "自动", detail: "进入 Agent 后直接开始生成" },
            { id: "manual", title: "手动", detail: "先带入草稿，由你确认后发送" },
          ] as const).map((option) => (
            <button
              key={option.id}
              type="button"
              className={`${styles.menuItem} ${mode === option.id ? styles.menuItemSelected : ""}`}
              onClick={() => { setMode(option.id); setOpenTool(null); }}
            >
              <span>{option.title}<small>{option.detail}</small></span>
              {mode === option.id && <Check size={14} />}
            </button>
          ))}
        </div>
      );
    }
    if (!user) {
      return (
        <div className={styles.toolMenu}>
          <strong>{composerTools.find((item) => item.id === tool)?.label}</strong>
          <p>登录后可使用自己的资产与 Skill。</p>
          <button type="button" className={styles.menuItem} onClick={openLogin}>登录后继续 <ArrowRight size={14} /></button>
        </div>
      );
    }
    if (tool === "attachments") {
      return (
        <div className={styles.toolMenu}>
          <strong>插入附件</strong>
          <button type="button" className={styles.menuItem} onClick={() => fileRef.current?.click()} disabled={uploading}>
            <Paperclip size={15} /><span>{uploading ? "正在上传…" : "从电脑上传"}<small>单个文件不超过 5 MB</small></span>
          </button>
          <div className={styles.menuDivider} />
          <span className={styles.menuCaption}>已有资产</span>
          <div className={styles.menuList}>
            {assets.length ? assets.map((asset) => (
              <button
                key={asset.id}
                type="button"
                className={styles.menuItem}
                onClick={() => {
                  composerRef.current?.insertToken({ type: "asset", id: asset.id, label: asset.name }, false);
                  setAssetIds((current) => [...current, asset.id]);
                }}
              >
                <span>{asset.name}</span>
              </button>
            )) : <p>还没有资产。可以先上传一份资料。</p>}
          </div>
        </div>
      );
    }
    const entries = market.filter((entry) => `${entry.title} ${entry.description}`.toLowerCase().includes(toolSearch.toLowerCase()));
    return (
      <div className={styles.toolMenu}>
        <strong>插入 Skill</strong>
        <input
          className={styles.menuSearch}
          value={toolSearch}
          onChange={(event) => setToolSearch(event.target.value)}
          placeholder="搜索 Skill"
          aria-label="搜索 Skill"
        />
        <div className={styles.menuList}>
          {entries.length ? entries.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={styles.menuItem}
              onClick={() => {
                composerRef.current?.insertToken({ type: "skill", id: entry.id, label: entry.title }, false);
                setMethodIds((current) => [...current, entry.id]);
              }}
            >
              <span>{entry.title}<small>{entry.description}</small></span>
            </button>
          )) : <p>没有找到可用的 Skill。</p>}
        </div>
      </div>
    );
  }

  return (
    <AppShell>
      <div className={styles.page}>
        <section ref={heroRef} className={`${styles.hero} ${hideHeroCard ? styles.heroWithoutCard : ""}`}>
          <div className={styles.aeroLayer} aria-hidden="true">
            <AeroShards
              backgroundColor={theme === "dark" ? "#161618" : "#FFFFFF"}
              shardColor={theme === "dark" ? "#696973" : "#C2C7D0"}
              accentColor={theme === "dark" ? "#E4E4E7" : "#59606B"}
              placement="full" flow="stream" material="pearl" detail="balanced" effect="none"
              scale={1} spread={1} depth={1} speed={0.0875} spin={0.0875} interaction="repel"
              density={0.9} shardSize={1.1} stretch={1} turbulence={0.45} glow={0.65}
              edgeSoftness={2} bloom={0.3} grain={0.03} chromaticAberration={0}
              transitionDuration={1} interactionRadius={1.5} interactionStrength={0.25}
              rippleIntensity={0.5} holdToGather
            />
          </div>
          <div className={styles.heroMeta}>
            <span>WEAVL / CREATIVE WORKSPACE</span>
            <span>从想法到作品，再到可复用的方法</span>
          </div>
          <div ref={heroContentRef} className={styles.heroContent}>
            <h1 ref={heroTitleRef}>
              拾起微光，织成作品，
              <br />让<em>灵感</em>，继续生长。
            </h1>
            <p ref={heroDescriptionRef}>从对话、画布或工作流开始，让资料、方法与作品沉淀，随时取用、继续创作。</p>
            <div className={styles.prompt}>
              <InlineComposer
                ref={composerRef}
                value={initialPrompt}
                onValueChange={(value) => { promptRef.current = value; }}
                onTokenRemove={(token) => {
                  if (token.type === "asset") setAssetIds((current) => removeFirst(current, token.id));
                  if (token.type === "skill") setMethodIds((current) => removeFirst(current, token.id));
                  if (token.type === "model") setModelKinds((current) => removeFirst(current, token.id as ModelKind));
                }}
                onSubmit={() => begin()}
                placeholder="描述你想完成的内容…"
              />
              <input ref={fileRef} type="file" multiple hidden onChange={(event) => void addFiles(event.target.files)} />
              <div className={styles.promptFooter}>
                <div className={styles.promptTools}>
                  {composerTools.map((tool) => {
                    const Icon = tool.icon;
                    const active = tool.id === "mode" && mode === "manual";
                    return (
                      <ActionPopover
                        key={tool.id}
                        hint={tool.label}
                        open={openTool === tool.id}
                        onOpenChange={(open) => { setOpenTool(open ? tool.id : null); if (open) setToolSearch(""); }}
                        trigger={<button type="button" className={`${styles.toolButton} ${active ? styles.toolButtonActive : ""}`} aria-label={tool.label}><Icon size={15} strokeWidth={1.7} /></button>}
                      >
                        {renderToolContent(tool.id)}
                      </ActionPopover>
                    );
                  })}
                  <span className={styles.modeLabel}>{mode === "auto" ? "自动" : "手动"} · 模拟</span>
                </div>
                <ActionPopover
                  mode="hover"
                  trigger={
                    <button type="button" className={styles.sendButton} onClick={() => begin()} aria-label="开始创作" disabled={uploading}>
                      <ArrowUp size={17} />
                    </button>
                  }
                >
                  开始创作
                </ActionPopover>
              </div>
            </div>
            {composerError && <p className={styles.composerError} role="alert">{composerError}</p>}
            <div className={styles.quick}>
              {examples.map((item) => (
                <button key={item} onClick={() => begin(item)}>
                  {item} <ArrowRight size={12} />
                </button>
              ))}
            </div>
          </div>
          <div className={styles.heroSide}>
            <div className={styles.heroTilt} {...heroTiltHandlers}>
              <GlareHover className={styles.artwork} width="100%" height="100%" background="var(--artwork-bg)" borderRadius="14px" borderColor="var(--artwork-border)" glareColor="var(--artwork-glare)" glareAngle={-35} glareSize={185} transitionDuration={850}>
                <span>IDEA → WORK</span>
                <div className={styles.artworkShape}>
                  <span>W</span>
                </div>
                <small>灵感 / 方法 / 作品</small>
              </GlareHover>
            </div>
          </div>
        </section>
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <div>
              <span className={styles.overline}>ONE CONNECTED STUDIO</span>
              <h2>按照你的方式工作</h2>
            </div>
            <p>丰富的工作方式，总有一款适合你。</p>
          </div>
          <div className={styles.abilityGrid}>
            {abilities.map((item) => (
              <AbilityCard key={item.title} {...item} onClick={() => router.push(item.href)} />
            ))}
          </div>
        </section>
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <div>
              <span className={styles.overline}>MODEL & FORMAT</span>
              <h2>能力边界，清楚可见</h2>
            </div>
            <p>模型供应商接入前，先把项目、流程和资产体验做好。页面会清楚标明模拟与可用状态。</p>
          </div>
          <div className={styles.capabilities}>
            {capabilities.map((item) => (
              <div key={item.name}>
                <span className={styles.capName}>{item.name}</span>
                <span>{item.desc}</span>
                <strong>{item.status}</strong>
              </div>
            ))}
          </div>
        </section>
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <div>
              <span className={styles.overline}>EXAMPLE WORK</span>
              <h2>从资料，到可交付内容</h2>
            </div>
            <p>下方案例为流程演示，并非真实客户效果或已接入的视频生成结果。</p>
          </div>
          <div className={styles.cases}>
            <button onClick={() => router.push("/workflows")}>
              <span className={styles.caseOne}>
                IP <i>01</i>
              </span>
              <span className={styles.caseInfo}>
                <strong>人物 IP 内容策划</strong>
                <small>访谈 / 定位 / 选题 / 脚本 / 审核</small>
                <span>
                  演示流程 <ArrowRight size={13} />
                </span>
              </span>
            </button>
            <button onClick={() => router.push("/workflows")}>
              <span className={styles.caseTwo}>
                <i>WEEKLY</i>
                <b>REPORT</b>
              </span>
              <span className={styles.caseInfo}>
                <strong>团队周报提炼</strong>
                <small>进度记录 / 摘要 / 审核 / 文稿</small>
                <span>
                  演示流程 <ArrowRight size={13} />
                </span>
              </span>
            </button>
            <button onClick={() => router.push("/projects")}>
              <span className={styles.caseThree}>
                <i>CANVAS</i>
                <b>OBJECTS / SPACE</b>
              </span>
              <span className={styles.caseInfo}>
                <strong>画布与共享资产</strong>
                <small>来自 Agent 和工作流的同一份成果</small>
                <span>
                  打开项目 <ArrowRight size={13} />
                </span>
              </span>
            </button>
          </div>
        </section>
        {/* TODO:暂时先隐藏，项目调整完毕后放开 */}
        {/* {user && (projects.length > 0 || conversations.length > 0) && (
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <div>
                <span className={styles.overline}>PICK UP WHERE YOU LEFT OFF</span>
                <h2>继续工作</h2>
              </div>
            </div>
            <div className={styles.recent}>
              {projects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => router.push(`/canvas?projectId=${project.id}&canvasId=${project.canvases[0]?.id}`)}
                >
                  <LayoutGrid size={16} />
                  <span>{project.name}</span>
                  <small>项目 · {project.canvases.length} 张画布</small>
                  <ArrowRight size={13} />
                </button>
              ))}
              {conversations.map((conversation) => (
                <button key={conversation.id} onClick={() => router.push("/agent")}>
                  <Bot size={16} />
                  <span>{conversation.title}</span>
                  <small>Agent 会话</small>
                  <ArrowRight size={13} />
                </button>
              ))}
            </div>
          </section>
        )} */}
      </div>
    </AppShell>
  );
}
