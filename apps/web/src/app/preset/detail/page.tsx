"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Coins, Sparkles } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { toast } from "@/hooks/useToast";
import { API } from "@/lib/env";
import {
  DEFAULT_DISPLAY,
  TEMPLATE_DISPLAY,
} from "../display";
import { STEP_KIND_META, stepKindOf, stepNameOf } from "@/utils/templateStep";
import type { TemplateDetail } from "@/types/template";
import styles from "./page.module.scss";

/** 一条对话消息 */
interface ChatMsg {
  role: "agent" | "user";
  text: string;
}

/**
 * 为十六进制颜色添加透明度，供内联样式使用。
 *
 * @param hex - 六位十六进制颜色。
 * @param alpha - 透明度。
 * @returns rgba 颜色；输入无效时返回原值。
 */
function hexAlpha(hex: string, alpha: number): string {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex);
  const h = m?.[1];
  if (!h) return hex;
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 0xff}, ${(n >> 8) & 0xff}, ${n & 0xff}, ${alpha})`;
}

/**
 * 预设详情 · Agent 工作流（/preset/detail?id=xxx）
 * 静态导出兼容：用 searchParams 而非动态路由段。
 *
 * 左：流程步骤（含确认门）
 * 右：Agent 对话（运行状态以 Agent 消息播报）
 * 底部：启动工作流（POST /runs）
 *
 * @returns 预设详情、Agent 对话和工作流启动界面。
 */
export default function PresetDetailPage() {
  const router = useRouter();
  /* 用 window.location.search 代替 useSearchParams：
     避免 Next.js 静态导出 + Turbopack HMR 下 useSearchParams 触发的 Suspense 要求，
     并消除 hydration mismatch / asset 404（basePath 在嵌套路由下偶尔拼接错）。 */
  const [id, setId] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    setId(sp.get("id") ?? "");
  }, []);

  const [template, setTemplate] = useState<TemplateDetail | null>(null);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [chatDraft, setChatDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [running, setRunning] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  /* 加载模板详情（GET /templates/:id，含完整 steps）+ 初始化 Agent 开场白 */
  useEffect(() => {
    if (!id) return;
    fetch(`${API}/templates/${encodeURIComponent(id)}`)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json() as Promise<TemplateDetail>;
      })
      .then((t) => {
        setTemplate(t);
        const display = TEMPLATE_DISPLAY[t.id] ?? DEFAULT_DISPLAY;
        setChat([
          {
            role: "agent",
            text: display.intro,
          },
        ]);
      })
      .catch(() => toast("模板加载失败，请确认 API 服务已启动"));
  }, [id]);

  /* 对话流自动滚底 */
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chat]);

  /* TODO(preset-agent): 将模板详情对话接入 Agent 会话和真实上下文。 */
  const sendChat = useCallback(() => {
    const text = chatDraft.trim();
    if (!text) return;
    setChat((c) => [
      ...c,
      { role: "user", text },
      {
        role: "agent",
        text: "收到。我会把这些要求带入编排；确认门环节你可以逐项把关或要求重生成。",
      },
    ]);
    setChatDraft("");
  }, [chatDraft]);

  /* 启动工作流：POST /runs —— 状态以 Agent 消息播报 */
  const startRun = useCallback(async () => {
    if (!template || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`${API}/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: template.id, inputs: {} }),
      });
      const data = (await res.json()) as { id?: string; status?: string; message?: string };
      if (!res.ok) throw new Error(data.message ?? "启动失败");
      setRunning(true);
      setChat((c) => [
        ...c,
        {
          role: "agent",
          text: `工作流已启动（运行 ${data.id ?? ""}）。状态：${data.status ?? "running"}，我会在这里同步进度。`,
        },
      ]);
      toast("工作流已启动", "success");
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [template, busy]);

  if (!template) {
    return (
      <AppShell>
        <p className={styles.loading}>预设加载中…</p>
      </AppShell>
    );
  }

  const gateByStep = new Map(template.gates.map((g) => [g.afterStep, g]));

  /* 真实 steps 与确认门合并：门跟在对应步骤后，未匹配步骤的门追加末尾 */
  const rows: Array<
    | { type: "step"; name: string; kindLabel: string; kindColor: string }
    | { type: "gate"; title: string; kindColor: string }
  > = [];
  const coveredGates = new Set<string>();
  let lastStepColor = "#5e5e66";
  for (const s of template.steps) {
    const kind = stepKindOf(s.type);
    const meta = STEP_KIND_META[kind] ?? STEP_KIND_META.llm!;
    lastStepColor = meta.color;
    rows.push({
      type: "step",
      name: stepNameOf(s.id),
      kindLabel: meta.label,
      kindColor: meta.color,
    });
    const gate = gateByStep.get(s.id);
    if (gate) {
      coveredGates.add(s.id);
      rows.push({ type: "gate", title: gate.title, kindColor: meta.color });
    }
  }
  for (const g of template.gates) {
    if (!coveredGates.has(g.afterStep)) {
      rows.push({ type: "gate", title: g.title, kindColor: lastStepColor });
    }
  }

  const costLabel = Math.max(1, Math.round(template.cost.min * 100));

  return (
    <AppShell>
      <div className={styles.page}>
        {/* 顶部面包屑 */}
        <div className={styles.crumb}>
          <button className={styles.back} onClick={() => router.push("/preset")}>
            ‹ 返回预设市场
          </button>
          <span className={styles.crumbSep}>/</span>
          <span className={styles.crumbName}>{template.name}</span>
          <span className={styles.costPill}>
            <Coins size={11} />
            预计消耗 {costLabel}
          </span>
        </div>

        <div className={styles.main}>
          {/* 左栏：工作流 */}
          <section className={styles.flowCard}>
            <div className={styles.flowHead}>
              <span className={styles.flowIcon}>
                <Sparkles size={12} />
              </span>
              <h2 className={styles.flowTitle}>Agent 工作流</h2>
              <span className={styles.flowStat}>
                {template.totalSteps} 步 · {template.gates.length} 个确认门
              </span>
            </div>
            <div className={styles.flowList}>
              {(() => {
                /* 序号只在步骤上行累计，确认门不占用序号 */
                let seq = 0;
                return rows.map((row, i) => {
                  if (row.type === "step") {
                    seq += 1;
                    return (
                      <div key={i} className={styles.stepRow}>
                        <span className={styles.stepBar} style={{ background: row.kindColor }} />
                        <span className={styles.stepNo}>{String(seq).padStart(2, "0")}</span>
                        <span className={styles.stepName}>{row.name}</span>
                        <span className={styles.stepKind} style={{ color: row.kindColor }}>
                          {row.kindLabel}
                        </span>
                      </div>
                    );
                  }
                  return (
                    <div key={i} className={styles.gateRow}>
                      <span className={styles.stepBar} style={{ background: "transparent" }} />
                      <span className={styles.gateMark} style={{ color: row.kindColor }}>
                        ◆
                      </span>
                      <span className={styles.gateName}>{row.title}</span>
                      <span
                        className={styles.gateTag}
                        style={{ borderColor: hexAlpha(row.kindColor, 0.4), color: row.kindColor }}
                      >
                        人工确认
                      </span>
                    </div>
                  );
                });
              })()}
            </div>
          </section>

          {/* 右栏：Agent 对话 */}
          <section className={styles.chatCard}>
            <div className={styles.chatHead}>
              <span className={styles.chatAvatar}>织</span>
              <span className={styles.chatName}>织光 Agent</span>
              <span className={styles.chatModel}>✦ Weavl LLM</span>
            </div>
            <div className={styles.chatBody}>
              {chat.map((m, i) => (
                <div key={i} className={`${styles.msgRow} ${m.role === "user" ? styles.msgRowUser : ""}`}>
                  <div className={`${styles.bubble} ${m.role === "user" ? styles.bubbleUser : ""}`}>{m.text}</div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <div className={styles.chatInputRow}>
              <input
                className={styles.chatInput}
                placeholder="和 Agent 聊聊你的想法…"
                value={chatDraft}
                onChange={(e) => setChatDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendChat();
                  }
                }}
              />
              <button className={styles.chatSend} onClick={sendChat} aria-label="发送">
                ➤
              </button>
            </div>
          </section>
        </div>

        {/* 底部动作条 */}
        <div className={styles.actions}>
          <button
            className={styles.previewBtn}
            onClick={() => router.push(`/workflow?id=${encodeURIComponent(template.id)}`)}
          >
            进入工作流
          </button>
          <button className={styles.startBtn} onClick={startRun} disabled={busy || running}>
            {busy ? "启动中…" : running ? "运行中" : `启动工作流 · ${costLabel} 积分`}
          </button>
        </div>
      </div>
    </AppShell>
  );
}
