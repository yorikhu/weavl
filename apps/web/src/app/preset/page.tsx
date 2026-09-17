"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Loader2, Plus, Send, Sparkles, Wand2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { API } from "@/lib/env";
import { CATEGORY_TABS, DEFAULT_DISPLAY, TEMPLATE_DISPLAY } from "./display";
import type { TemplateSummary } from "@/types/template";
import styles from "./page.module.scss";

/* ========================================================================
 * 预设市场 —— AI 对话驱动版
 *
 * 布局：
 *   左 60%：分类 tab + 卡片网格（AI 推荐的卡片会高亮）
 *   右 40%：织光 Agent 对话窗口（顶部 +新建按钮 + 快捷话题 + 气泡）
 *
 * AI 推荐（当前为关键词匹配）：
 *   用户输入 → 命中预设话题 → 返回对应模板 id → 卡片加 ⭐ 高亮
 * ====================================================================== */

/** 快捷话题：点击直接进入对话 */
const QUICK_TOPICS = [
  { icon: "✨", label: "小红书种草图文", keywords: ["小红书", "种草", "图文"] },
  { icon: "🎬", label: "短视频脚本", keywords: ["短视频", "脚本", "视频"] },
  { icon: "🛒", label: "商品详情页", keywords: ["商品", "详情"] },
  { icon: "📊", label: "数据分析报告", keywords: ["数据", "分析", "报告"] },
  { icon: "🎙️", label: "配音视频", keywords: ["配音", "tts"] },
  { icon: "📝", label: "广告文案", keywords: ["文案", "广告"] },
] as const;

/** TODO(preset-agent): 用 Agent/LLM 推荐接口替换关键词到模板的静态映射。 */
const KEYWORD_TO_TEMPLATE: Record<string, string> = {
  小红书: "ecom.xhs-note",
  种草: "ecom.xhs-note",
  图文: "ecom.xhs-note",
};

/** Agent 对话消息 */
interface ChatMsg {
  id: string;
  role: "agent" | "user";
  text: string;
  /** 命中的推荐模板 id（仅 agent 推荐回复时有） */
  recommend?: string;
}

/**
 * 渲染兼容预设市场。
 *
 * @returns 预设列表和推荐对话页面。
 */
export default function PresetMarketPage() {
  const router = useRouter();

  /* ------- 数据 ------- */
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [error, setError] = useState(false);
  const [tab, setTab] = useState<string>("all");

  /* ------- AI 对话 ------- */
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  /** AI 当前推荐的模板 id（高亮左侧卡片） */
  const [recommended, setRecommended] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetch(`${API}/templates`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((list: TemplateSummary[]) => {
        setTemplates(list ?? []);
        /* 首屏欢迎语：根据已有模板动态生成 */
        setChat([
          {
            id: "welcome",
            role: "agent",
            text:
              list && list.length > 0
                ? `你好！我是织光。告诉我你想做什么，我来帮你挑最合适的预设（比如"小红书种草"）。也可以从下方挑一个直接开始。`
                : "你好！我是织光。告诉我你想做什么，我帮你创建工作流。",
          },
        ]);
      })
      .catch(() => {
        setError(true);
        setChat([
          {
            id: "welcome",
            role: "agent",
            text: "你好！我是织光。告诉我你想做什么，我帮你创建工作流。",
          },
        ]);
      });
  }, []);

  /* 对话自动滚到底 */
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chat, busy]);

  /* 模板筛选 */
  const filtered = useMemo(
    () => (tab === "all" ? templates : templates.filter((t) => t.category === tab)),
    [templates, tab],
  );

  /* TODO(preset-agent): 接入 LLM 流式推荐；当前关键词匹配仅用于验证交互。 */
  function matchTemplate(text: string): string | null {
    for (const [kw, tid] of Object.entries(KEYWORD_TO_TEMPLATE)) {
      if (text.includes(kw) && templates.some((t) => t.id === tid)) return tid;
    }
    /* 兜底：用户描述超过 4 字，返回第一个模板 */
    if (text.trim().length > 4 && templates[0]) return templates[0].id;
    return null;
  }

  function buildAgentReply(userText: string, recommendedId: string | null): ChatMsg {
    if (!recommendedId) {
      return {
        id: `m-${Date.now()}`,
        role: "agent",
        text: "能再具体一点吗？比如「小红书种草图文」「短视频脚本」——或者点上面的快捷话题试试。",
      };
    }
    const tpl = templates.find((t) => t.id === recommendedId);
    if (!tpl) {
      return {
        id: `m-${Date.now()}`,
        role: "agent",
        text: "抱歉，没找到合适的预设。可以试试其他描述。",
      };
    }
    const display = TEMPLATE_DISPLAY[tpl.id] ?? DEFAULT_DISPLAY;
    return {
      id: `m-${Date.now()}`,
      role: "agent",
      text: `根据你的需求，我推荐「${tpl.name}」：\n${display.intro}\n流程：${display.summary}\n\n点左侧卡片预览，或直接 [进入工作流] 开始编排。`,
      recommend: tpl.id,
    };
  }

  /* 用户输入 → 当前推荐实现 → 命中模板。 */
  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    const userMsg: ChatMsg = {
      id: `u-${Date.now()}`,
      role: "user",
      text: trimmed,
    };
    setChat((c) => [...c, userMsg]);
    setInput("");
    setBusy(true);
    /* TODO(preset-agent): 接入流式响应后移除固定思考延迟。 */
    setTimeout(() => {
      const matchedId = matchTemplate(trimmed);
      setRecommended(matchedId);
      setChat((c) => [...c, buildAgentReply(trimmed, matchedId)]);
      setBusy(false);
    }, 600);
  }

  /* 快捷话题 */
  function pickTopic(topic: (typeof QUICK_TOPICS)[number]) {
    send(topic.label);
  }

  /* ------- 操作 ------- */
  function goTemplate(id: string) {
    router.push(`/preset/detail?id=${id}`);
  }

  function goNewWorkflow() {
    router.push("/workflow");
  }

  return (
    <AppShell>
      <div className={styles.market}>
        {/* 左侧：预设市场 */}
        <section className={styles.left}>
          <header className={styles.head}>
            <h1 className={styles.title}>预设市场</h1>
            <p className={styles.sub}>从预设开始，或让 AI 帮你挑选</p>
          </header>

          <button className={styles.newWorkflow} onClick={goNewWorkflow}>
            <Plus size={14} />
            <span>直接新建工作流</span>
          </button>

          <div className={styles.tabs}>
            {CATEGORY_TABS.map((t) => (
              <button
                key={t.key}
                className={`${styles.tab} ${tab === t.key ? styles.tabActive : ""}`}
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {error && <p className={styles.empty}>模板加载失败，请确认 API 服务已启动</p>}
          {!error && filtered.length === 0 && <p className={styles.empty}>该分类暂无预设</p>}

          <div className={styles.grid}>
            {filtered.map((t) => {
              const display = TEMPLATE_DISPLAY[t.id] ?? DEFAULT_DISPLAY;
              const isRecommended = recommended === t.id;
              return (
                <button
                  key={t.id}
                  className={`${styles.card} ${isRecommended ? styles.cardRecommended : ""}`}
                  onClick={() => goTemplate(t.id)}
                >
                  {isRecommended && (
                    <span className={styles.recommendBadge}>
                      <Sparkles size={11} /> AI 推荐
                    </span>
                  )}
                  <div className={styles.cover}>
                    {display.flow.map((kind, i) => (
                      <span key={i} className={styles.flowBar} data-kind={kind} />
                    ))}
                  </div>
                  <div className={styles.body}>
                    <h3 className={styles.name}>{t.name}</h3>
                    <p className={styles.summary}>
                      {display.summary} · {t.totalSteps} 步
                    </p>
                    <div className={styles.meta}>
                      <span className={styles.uses}>{display.uses} 使用</span>
                      <span className={styles.priceFree}>免费</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* 右侧：AI 对话窗口 */}
        <aside className={styles.right}>
          <header className={styles.chatHead}>
            <div className={styles.chatHeadLeft}>
              <span className={styles.chatAvatar}>
                <Bot size={14} />
              </span>
              <div className={styles.chatHeadText}>
                <span className={styles.chatName}>织光 Agent</span>
                <span className={styles.chatModel}>✦ Weavl LLM</span>
              </div>
            </div>
            <button className={styles.chatNewBtn} onClick={goNewWorkflow} title="新建空白工作流">
              <Plus size={12} />
              <span>新建</span>
            </button>
          </header>

          {/* 快捷话题（仅当只有欢迎语时显示） */}
          {chat.length <= 1 && (
            <div className={styles.topics}>
              <p className={styles.topicsTitle}>试试这些：</p>
              <div className={styles.topicsGrid}>
                {QUICK_TOPICS.map((t) => (
                  <button key={t.label} className={styles.topicChip} onClick={() => pickTopic(t)}>
                    <span className={styles.topicIcon}>{t.icon}</span>
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 对话气泡流 */}
          <div className={styles.chatBody}>
            {chat.map((m) => (
              <div key={m.id} className={`${styles.bubbleRow} ${m.role === "user" ? styles.bubbleRowUser : ""}`}>
                {m.role === "agent" && (
                  <span className={styles.bubbleAvatar}>
                    <Wand2 size={11} />
                  </span>
                )}
                <div className={styles.bubbleStack}>
                  <div className={`${styles.bubble} ${m.role === "user" ? styles.bubbleUser : styles.bubbleAgent}`}>
                    {m.text.split("\n").map((line, i) => (
                      <p key={i} className={styles.bubbleLine}>
                        {line}
                      </p>
                    ))}
                  </div>
                  {/* Agent 推荐卡片按钮 */}
                  {m.recommend && (
                    <button className={styles.recommendCard} onClick={() => goTemplate(m.recommend!)}>
                      <Sparkles size={12} />
                      <span>查看「{templates.find((t) => t.id === m.recommend)?.name}」</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
            {busy && (
              <div className={`${styles.bubbleRow} ${styles.bubbleRow}`}>
                <span className={styles.bubbleAvatar}>
                  <Wand2 size={11} />
                </span>
                <div className={`${styles.bubble} ${styles.bubbleAgent} ${styles.bubbleLoading}`}>
                  <Loader2 size={12} className={styles.spin} />
                  <span>正在思考...</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* 输入框 */}
          <div className={styles.chatInput}>
            <input
              className={styles.chatInputField}
              placeholder="告诉 AI 你想做什么..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              disabled={busy}
            />
            <button
              className={styles.chatSend}
              onClick={() => send(input)}
              disabled={busy || !input.trim()}
              aria-label="发送"
            >
              <Send size={13} />
            </button>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
