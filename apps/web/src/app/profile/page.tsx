"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Coins,
  Plus,
  FileCheck2,
  Clock,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  AlertCircle,
  MoreHorizontal,
  LayoutGrid,
  History,
  Settings,
  BookOpen,
  Image as ImageIcon,
  Download,
  Upload,
  Bot,
  Sun,
  Bell,
  User as UserIcon,
  Wand2,
  ChevronRight,
} from "lucide-react";
import type { RunView } from "@weavl/shared";
import styles from "./page.module.scss";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";

/* ---------------- 类型 ---------------- */

type Tab = "overview" | "assets" | "history" | "brand" | "settings";

interface ActivityItem {
  id: string;
  name: string;
  meta: string;
  status: "success" | "pending" | "failed";
  time: string;
}

/* ---------------- 顶部栏 ---------------- */

function Topbar() {
  return (
    <div className={styles.topbar}>
      <div className={styles.topbarLeft}>
        <div className={styles.brand}>
          <div className={styles.brandLogo}>W</div>
          <span className={styles.brandText}>织光 · 织光台</span>
        </div>
        <span className={styles.crumbSep}>/</span>
        <span className={styles.crumbCurrent}>个人中心</span>
      </div>
      <div className={styles.topbarRight}>
        <button className={styles.iconBtn} title="搜索">
          <Search size={14} />
        </button>
        <button className={styles.iconBtn} title="通知">
          <Bell size={14} />
        </button>
        <button className={styles.creditPill}>
          <Coins size={12} />45
        </button>
        <div className={styles.avatar}><UserIcon size={14} /></div>
      </div>
    </div>
  );
}

/* ---------------- 二级 tab ---------------- */

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: "overview", label: "总览", icon: <LayoutGrid size={12} /> },
  { key: "assets", label: "我的资产", icon: <ImageIcon size={12} /> },
  { key: "history", label: "任务历史", icon: <History size={12} /> },
  { key: "brand", label: "品牌库", icon: <BookOpen size={12} /> },
  { key: "settings", label: "设置", icon: <Settings size={12} /> },
];

function Tabs({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <div className={styles.tabs}>
      {TABS.map((t) => (
        <button
          key={t.key}
          className={`${styles.tab} ${active === t.key ? styles.tabActive : ""}`}
          onClick={() => onChange(t.key)}
        >
          {t.icon}
          {t.label}
        </button>
      ))}
    </div>
  );
}

/* ---------------- 通用：即将上线占位 ---------------- */

function ComingSoon({ title }: { title: string }) {
  return (
    <div className={styles.placeholder}>
      <div className={styles.placeholderIcon}><Sparkles size={24} /></div>
      <div className={styles.placeholderTitle}>{title}</div>
      <div className={styles.placeholderSub}>即将上线 · 当前 MVP 阶段仅总览可用</div>
    </div>
  );
}

/* ---------------- 总览 tab ---------------- */

function OverviewTab({ onGoPreset }: { onGoPreset: () => void }) {
  const [range, setRange] = useState<"week" | "month" | "all">("week");
  const [recent, setRecent] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`${API}/runs/latest/_pick`);
        if (!alive) return;
        if (res.ok) {
          const data: RunView = await res.json();
          const items: ActivityItem[] = [
            {
              id: data.id,
              name: data.contentPackage?.fields?.[0]?.value?.slice(0, 24) ?? data.templateId,
              meta: `${data.templateId} · ${data.decisions?.length ?? 0} 决策${data.actualCost ? ` · ¥${data.actualCost}` : ""}`,
              status: data.status === "succeeded" ? "success" : data.status === "awaiting_confirmation" ? "pending" : "pending",
              time: "刚刚",
            },
          ];
          setRecent(items);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  return (
    <div className={styles.overview}>
      {/* 北极星指标 */}
      <div className={styles.section}>
        <div className={styles.sectionHead}>
          <div>
            <div className={styles.sectionTag}>北极星指标</div>
            <div className={styles.sectionTitle}>每周可交付任务数</div>
          </div>
          <div className={styles.rangeToggle}>
            {(["week", "month", "all"] as const).map((r) => (
              <button
                key={r}
                className={`${styles.rangeBtn} ${range === r ? styles.rangeBtnActive : ""}`}
                onClick={() => setRange(r)}
              >
                {r === "week" ? "本周" : r === "month" ? "本月" : "全部"}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.northCard}>
          <div className={styles.northMain}>
            <div className={styles.northValue}>12</div>
            <div className={styles.northDelta}>
              <ArrowUpRight size={11} />
              <span>vs 上周 +20%</span>
            </div>
          </div>
          <svg className={styles.northChart} viewBox="0 0 280 60" preserveAspectRatio="none">
            <defs>
              <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.3"/>
                <stop offset="100%" stopColor="#f59e0b" stopOpacity="0"/>
              </linearGradient>
            </defs>
            <polygon points="0,42 35,38 70,40 105,30 140,32 175,22 210,18 245,12 280,8 280,60 0,60" fill="url(#trendFill)"/>
            <polyline points="0,42 35,38 70,40 105,30 140,32 175,22 210,18 245,12 280,8" fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round"/>
            <circle cx="280" cy="8" r="3" fill="#f59e0b"/>
          </svg>
        </div>
      </div>

      {/* 配套指标 */}
      <div className={styles.metricsGrid}>
        <MetricCard label="预设启动率" value="82%" delta="4%" trend="up" />
        <MetricCard label="任务完成率" value="68%" delta="6%" trend="up" />
        <MetricCard label="采纳/发布率" value="47%" delta="0" trend="flat" />
        <MetricCard label="30 日复用率" value="31%" delta="0" trend="flat" />
      </div>

      {/* 最近任务 */}
      <div className={styles.recentCard}>
        <div className={styles.recentHead}>
          <div className={styles.sectionTitle}>最近任务</div>
          <button className={styles.linkBtn}>查看全部 →</button>
        </div>
        {loading ? (
          <div className={styles.recentEmpty}>加载中…</div>
        ) : recent.length === 0 ? (
          <div className={styles.recentEmpty}>
            暂无任务记录 · <button className={styles.linkBtn} onClick={onGoPreset}>去新建一个 →</button>
          </div>
        ) : (
          <div className={styles.recentList}>
            {recent.map((it) => (
              <div key={it.id} className={styles.recentItem}>
                <div className={`${styles.recentIcon} ${styles[`status_${it.status}`]}`}>
                  {it.status === "success" && <CheckCircle2 size={14} />}
                  {it.status === "pending" && <Clock size={14} />}
                  {it.status === "failed" && <AlertCircle size={14} />}
                </div>
                <div className={styles.recentInfo}>
                  <div className={styles.recentName}>{it.name}</div>
                  <div className={styles.recentMeta}>{it.meta}</div>
                </div>
                <div className={styles.recentTime}>{it.time}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({
  label, value, delta, trend,
}: { label: string; value: string; delta: string; trend: "up" | "down" | "flat" }) {
  return (
    <div className={styles.metricCard}>
      <div className={styles.metricLabel}>{label}</div>
      <div className={styles.metricValue}>{value}</div>
      <div className={`${styles.metricDelta} ${trend === "up" ? styles.metricUp : trend === "down" ? styles.metricDown : styles.metricFlat}`}>
        {trend === "up" && <ArrowUpRight size={10} />}
        {trend === "down" && <ArrowDownRight size={10} />}
        {trend === "flat" && <span>—</span>}
        <span>{trend === "flat" ? "持平" : delta + "%"}</span>
      </div>
    </div>
  );
}

/* ---------------- 主组件 ---------------- */

export default function ProfilePage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <div className={styles.shell}>
      <Topbar />
      <Tabs active={tab} onChange={setTab} />

      <div className={styles.body}>
        {/* 左 280 侧栏 */}
        <aside className={styles.sidebar}>
          {/* 头像 + 资料 */}
          <div className={styles.profileCard}>
            <div className={styles.avatarBig}>M</div>
            <div className={styles.profileName}>周</div>
            <div className={styles.profileHandle}>@zxxx · 个人空间</div>
            <button className={styles.editBtn}>编辑资料</button>
          </div>

          {/* 本周数据 */}
          <div className={styles.statsBlock}>
            <div className={styles.blockLabel}>本周数据</div>
            <div className={styles.statsGrid}>
              <div className={styles.statItem}>
                <div className={styles.statLabel}>可交付任务</div>
                <div className={styles.statValueAccent}>12</div>
              </div>
              <div className={styles.statItem}>
                <div className={styles.statLabel}>素材沉淀</div>
                <div className={styles.statValue}>48</div>
              </div>
              <div className={styles.statItem}>
                <div className={styles.statLabel}>品牌库</div>
                <div className={styles.statValue}>3</div>
              </div>
              <div className={styles.statItem}>
                <div className={styles.statLabel}>草稿画布</div>
                <div className={styles.statValue}>2</div>
              </div>
            </div>
          </div>

          {/* 快捷入口 */}
          <div className={styles.shortcuts}>
            <div className={styles.blockLabel}>快捷入口</div>
            <button className={styles.shortcutBtn} onClick={() => router.push("/preset")}>
              <span className={`${styles.shortcutIcon} ${styles.scAmber}`}><Plus size={12} /></span>
              新建任务
            </button>
            <button className={styles.shortcutBtn} onClick={() => alert("导入素材：即将上线")}>
              <span className={`${styles.shortcutIcon} ${styles.scBlue}`}><Upload size={12} /></span>
              导入素材
            </button>
            <button className={styles.shortcutBtn} onClick={() => alert("创建品牌库：即将上线")}>
              <span className={`${styles.shortcutIcon} ${styles.scPink}`}><Plus size={12} /></span>
              创建品牌库
            </button>
            <button className={styles.shortcutBtn} onClick={() => alert("Agent 设置：即将上线")}>
              <span className={`${styles.shortcutIcon} ${styles.scGreen}`}><Bot size={12} /></span>
              Agent 设置
            </button>
          </div>
        </aside>

        {/* 主区 */}
        <main className={styles.main}>
          {tab === "overview" && <OverviewTab onGoPreset={() => router.push("/preset")} />}
          {tab === "assets" && <ComingSoon title="我的资产" />}
          {tab === "history" && <ComingSoon title="任务历史" />}
          {tab === "brand" && <ComingSoon title="品牌库" />}
          {tab === "settings" && <ComingSoon title="设置" />}
        </main>
      </div>
    </div>
  );
}
