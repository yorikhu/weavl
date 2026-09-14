"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Bell, Check, Coins, FolderOpen, Layers, MessagesSquare, Workflow } from "lucide-react";
import type { AccountPlan, AgentConversation, Asset, CanvasProject, WorkflowRunRecord } from "@weavl/shared";
import { AppShell } from "@/components/AppShell";
import { studioApi, jsonBody } from "@/lib/studioApi";
import { useAccount } from "@/provider/AccountProvider";
import { useAuth } from "@/provider/AuthProvider";
import { formatNumber } from "@/utils/formatNumber";
import ui from "@/styles/studio.module.scss";
import styles from "./page.module.scss";

type Tab = "overview" | "credits" | "plans" | "billing" | "notifications";
const tabs: { id: Tab; label: string }[] = [
  { id: "overview", label: "总览" },
  { id: "credits", label: "积分" },
  { id: "plans", label: "套餐" },
  { id: "billing", label: "订阅与发票" },
  { id: "notifications", label: "通知" },
];
const formatBytes = (bytes: number) =>
  bytes < 1024 ** 2
    ? `${(bytes / 1024).toFixed(1)} KB`
    : bytes < 1024 ** 3
      ? `${(bytes / 1024 ** 2).toFixed(1)} MB`
      : `${(bytes / 1024 ** 3).toFixed(1)} GB`;

export default function ProfilePage() {
  const router = useRouter();
  const { user } = useAuth();
  const { account, refresh } = useAccount();
  const [tab, setTab] = useState<Tab>("overview");
  const [counts, setCounts] = useState<number[] | null>(null);
  const [plans, setPlans] = useState<AccountPlan[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("tab");
    if (tabs.some((item) => item.id === requested)) setTab(requested as Tab);
    void studioApi<AccountPlan[]>("/studio/account/plans")
      .then(setPlans)
      .catch((cause) => setError((cause as Error).message));
    void Promise.all([
      studioApi<CanvasProject[]>("/studio/projects"),
      studioApi<AgentConversation[]>("/studio/conversations"),
      studioApi<WorkflowRunRecord[]>("/studio/workflows/runs"),
      studioApi<Asset[]>("/studio/assets"),
    ])
      .then(([projects, conversations, runs, assets]) =>
        setCounts([projects.length, conversations.length, runs.length, assets.length]),
      )
      .catch((cause) => setError((cause as Error).message));
  }, []);

  function changeTab(next: Tab) {
    setTab(next);
    window.history.replaceState(null, "", `/profile?tab=${next}`);
    setError("");
    setMessage("");
  }
  async function requestPlan(plan: AccountPlan["id"]) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await studioApi("/studio/account/plan-requests", { method: "POST", body: jsonBody({ plan }) });
      await refresh();
      setMessage(`${plan} 开通意向已记录。当前为模拟阶段，尚未支付或开通。`);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function readEvent(id: string) {
    try {
      await studioApi(`/studio/account/events/${id}/read`, { method: "PATCH" });
      await refresh();
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  const links = [
    { label: "项目", path: "/projects", icon: Layers },
    { label: "Agent 会话", path: "/agent", icon: MessagesSquare },
    { label: "工作流运行", path: "/workflows", icon: Workflow },
    { label: "资产", path: "/assets", icon: FolderOpen },
  ];
  return (
    <AppShell>
      <div className={ui.page}>
        <header className={ui.header}>
          <div>
            <span className={ui.eyebrow}>ACCOUNT</span>
            <h1 className={ui.title}>个人中心</h1>
            <p className={ui.description}>账户、积分、套餐与工作空间概览。</p>
          </div>
        </header>
        <div className={ui.tabs}>
          {tabs.map((item) => (
            <button
              key={item.id}
              className={`${ui.tab} ${tab === item.id ? ui.tabActive : ""}`}
              onClick={() => changeTab(item.id)}
            >
              {item.label}
              {item.id === "notifications" && account?.unreadNotifications ? ` · ${account.unreadNotifications}` : ""}
            </button>
          ))}
        </div>
        {error && <p className={ui.error}>{error}</p>}
        {message && <p className={styles.notice}>{message}</p>}
        {tab === "overview" && (
          <div className={styles.section}>
            <div className={styles.summaryGrid}>
              <section className={`${ui.card} ${styles.identity}`}>
                <span className={ui.eyebrow}>账户</span>
                <h2>{user?.name}</h2>
                <p>{user?.email}</p>
                <span className={ui.meta}>
                  加入于 {user?.createdAt ? new Date(user.createdAt).toLocaleDateString("zh-CN") : "—"}
                </span>
              </section>
              <button className={`${ui.card} ${styles.summaryButton}`} onClick={() => changeTab("credits")}>
                <span className={ui.eyebrow}>可用积分</span>
                <strong>{account ? formatNumber(account.credits) : "—"}</strong>
                <span className={ui.meta}>
                  模拟生成目前不扣积分 <ArrowUpRight size={13} />
                </span>
              </button>
              <button className={`${ui.card} ${styles.summaryButton}`} onClick={() => changeTab("plans")}>
                <span className={ui.eyebrow}>当前套餐</span>
                <strong>{account?.plan ?? "—"}</strong>
                <span className={ui.meta}>
                  查看套餐 <ArrowUpRight size={13} />
                </span>
              </button>
            </div>
            <section className={`${ui.card} ${styles.storage}`}>
              <div className={ui.rowBetween}>
                <div>
                  <span className={ui.eyebrow}>资产容量</span>
                  <h3>
                    {account ? formatBytes(account.storageUsed) : "—"}{" "}
                    <small>/ {account ? formatBytes(account.storageLimit) : "—"}</small>
                  </h3>
                </div>
                <button className={ui.buttonQuiet} onClick={() => router.push("/assets")}>
                  管理资产 <ArrowUpRight size={13} />
                </button>
              </div>
              <div className={styles.bar}>
                <span
                  style={{
                    width: `${account ? Math.min(100, (account.storageUsed / account.storageLimit) * 100) : 0}%`,
                  }}
                />
              </div>
              <p className={ui.cardText}>按当前未删除资产的最新版本统计；生产环境接入对象存储后以实际用量为准。</p>
            </section>
            <div className={ui.grid}>
              {links.map((item, index) => (
                <button
                  key={item.path}
                  className={`${ui.card} ${styles.linkCard}`}
                  onClick={() => router.push(item.path)}
                >
                  <div className={ui.rowBetween}>
                    <item.icon size={18} />
                    <ArrowUpRight size={15} />
                  </div>
                  <h3>{item.label}</h3>
                  <p>{counts ? `${counts[index]} 项` : "正在加载…"}</p>
                </button>
              ))}
            </div>
          </div>
        )}
        {tab === "credits" && (
          <div className={styles.section}>
            <section className={`${ui.card} ${styles.creditHero}`}>
              <Coins size={20} />
              <span>可用积分</span>
              <strong>{account ? formatNumber(account.credits) : "—"}</strong>
              <p>当前 Agent 与工作流使用模拟生成，不扣除积分。真实计费与充值会在模型服务接入后开放。</p>
            </section>
            <h2 className={styles.sectionTitle}>积分记录</h2>
            {account?.events
              .filter((event) => event.type === "credit")
              .map((event) => (
                <article className={`${ui.card} ${styles.event}`} key={event.id}>
                  <div>
                    <strong>{event.title}</strong>
                    <p>{event.detail}</p>
                  </div>
                  <div>
                    <b>
                      {event.delta === undefined ? "—" : `${event.delta > 0 ? "+" : ""}${formatNumber(event.delta)}`}
                    </b>
                    <small>{new Date(event.createdAt).toLocaleString("zh-CN")}</small>
                  </div>
                </article>
              ))}
          </div>
        )}
        {tab === "plans" && (
          <div className={styles.section}>
            <p className={ui.description}>以下为模拟套餐与容量配置。价格、支付和正式权益尚未接入；可提交开通意向。</p>
            <div className={styles.planGrid}>
              {plans.map((plan) => (
                <article className={`${ui.card} ${styles.planCard}`} key={plan.id}>
                  <div className={ui.rowBetween}>
                    <span className={ui.eyebrow}>{plan.id}</span>
                    {account?.plan === plan.id && <span className={ui.badge}>当前套餐</span>}
                  </div>
                  <h2>{plan.name}</h2>
                  <p>{plan.description}</p>
                  <div className={styles.planQuota}>
                    {formatBytes(plan.storageLimit)} <small>资产容量</small>
                  </div>
                  <button
                    className={
                      account?.plan === plan.id || account?.pendingPlan === plan.id ? ui.buttonQuiet : ui.button
                    }
                    disabled={busy || account?.plan === plan.id || account?.pendingPlan === plan.id}
                    onClick={() => void requestPlan(plan.id)}
                  >
                    {account?.plan === plan.id
                      ? "使用中"
                      : account?.pendingPlan === plan.id
                        ? "意向已提交"
                        : "申请开通"}
                  </button>
                </article>
              ))}
            </div>
          </div>
        )}
        {tab === "billing" && (
          <div className={styles.section}>
            <section className={`${ui.card} ${styles.billing}`}>
              <span className={ui.eyebrow}>订阅状态</span>
              <h2>{account?.plan === "Free" ? "免费版" : (account?.plan ?? "读取中")}</h2>
              <p>当前没有支付订单或发票记录。套餐申请仅记录意向，不会产生扣款。</p>
              {account?.pendingPlan && <p>已申请：{account.pendingPlan} · 待开通</p>}
              <button className={ui.buttonQuiet} onClick={() => changeTab("plans")}>
                查看套餐 <ArrowUpRight size={13} />
              </button>
            </section>
          </div>
        )}
        {tab === "notifications" && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>
              <Bell size={17} /> 通知
            </h2>
            {!account?.events.some((event) => event.type !== "credit") && <div className={ui.empty}>暂无通知。</div>}
            {account?.events
              .filter((event) => event.type !== "credit")
              .map((event) => (
                <article className={`${ui.card} ${styles.event}`} key={event.id}>
                  <div>
                    <strong>{event.title}</strong>
                    <p>{event.detail}</p>
                    <small>{new Date(event.createdAt).toLocaleString("zh-CN")}</small>
                  </div>
                  {!event.readAt && (
                    <button className={ui.buttonQuiet} onClick={() => void readEvent(event.id)}>
                      <Check size={13} />
                      标记已读
                    </button>
                  )}
                </article>
              ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
