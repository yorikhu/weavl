"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Plus, Search, Wrench, X } from "lucide-react";
import type { MarketEntry } from "@weavl/shared";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/provider/AuthProvider";
import { jsonBody, studioApi } from "@/lib/studioApi";
import ui from "@/styles/studio.module.scss";
import styles from "./page.module.scss";

type Filter = "skill" | "mine";
const emptyForm = {
  type: "skill" as const,
  title: "",
  description: "",
  content: "",
  inputHint: "文字说明",
  outputKind: "text" as const,
};

export default function MarketPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [entries, setEntries] = useState<MarketEntry[]>([]);
  const [filter, setFilter] = useState<Filter>("skill");
  const [query, setQuery] = useState("");
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("tab");
    if (requested === "mine") setFilter("mine");
    if ((requested && requested !== "skill" && requested !== "mine") || params.has("type")) {
      window.history.replaceState(null, "", `/market?tab=${requested === "mine" ? "mine" : "skill"}`);
    }
  }, []);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState("");
  const refresh = useCallback(
    () =>
      studioApi<MarketEntry[]>("/studio/market")
        .then(setEntries)
        .catch((cause) => setError((cause as Error).message)),
    [],
  );
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const searchTerm = query.trim().toLowerCase();
  const visible = entries.filter((entry) => {
    const inCurrentTab = filter === "mine" ? entry.ownerId === user?.id : entry.type === "skill";
    return (
      inCurrentTab &&
      (!searchTerm ||
        `${entry.title} ${entry.description} ${entry.inputHint} ${entry.content}`.toLowerCase().includes(searchTerm))
    );
  });

  function selectTab(next: Filter) {
    setFilter(next);
    window.history.replaceState(null, "", `/market?tab=${next}`);
  }

  async function save() {
    setError("");
    try {
      await studioApi(`/studio/market${editingId ? `/${editingId}` : ""}`, {
        method: editingId ? "PATCH" : "POST",
        body: jsonBody(form),
      });
      setFormOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      setQuery("");
      setFilter("mine");
      window.history.replaceState(null, "", "/market?tab=mine");
      await refresh();
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  function edit(entry: MarketEntry) {
    setForm({
      type: "skill",
      title: entry.title,
      description: entry.description,
      content: entry.content,
      inputHint: entry.inputHint,
      outputKind: "text",
    });
    setEditingId(entry.id);
    setFormOpen(true);
  }

  async function remove(entry: MarketEntry) {
    if (!window.confirm(`删除「${entry.title}」？已生成的资产不会删除。`)) return;
    try {
      await studioApi(`/studio/market/${entry.id}`, { method: "DELETE" });
      await refresh();
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  function openEntry(entry: MarketEntry) {
    sessionStorage.setItem("weavl:market-id", entry.id);
    router.push("/agent");
  }

  return (
    <AppShell>
      <div className={ui.page}>
        <header className={ui.header}>
          <div>
            <span className={ui.eyebrow}>METHOD LIBRARY</span>
            <h1 className={ui.title}>市场</h1>
            <p className={ui.description}>让经验沉淀为 Skill，让灵感沿着方法继续生长。</p>
          </div>
          <button
            className={ui.button}
            onClick={() => {
              setForm(emptyForm);
              setEditingId(null);
              setFormOpen(true);
            }}
          >
            <Plus size={14} />
            创建 Skill
          </button>
        </header>
        <div className={ui.tabs}>
          {(["skill", "mine"] as Filter[]).map((key) => (
            <button
              key={key}
              className={`${ui.tab} ${filter === key ? ui.tabActive : ""}`}
              onClick={() => selectTab(key)}
            >
              {key === "skill" ? "Skill" : "我的创作"}
            </button>
          ))}
        </div>
        <div className={styles.mineTools}>
          <span className={styles.resultCount}>
            {visible.length} 项{query.trim() ? "匹配结果" : "内容"}
          </span>
          <label className={styles.search}>
            <Search size={14} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={filter === "skill" ? "搜索 Skill" : "搜索我的创作"}
              aria-label={filter === "skill" ? "搜索 Skill" : "搜索我的创作"}
            />
          </label>
        </div>
        {error && <p className={ui.error}>{error}</p>}
        <div className={`${ui.grid} ${styles.grid}`}>
          {visible.map((entry) => (
            <article key={entry.id} className={`${ui.card} ${styles.entry}`}>
              <div className={styles.entryTop}>
                <span className={styles.symbol}><Wrench size={20} strokeWidth={1.4} /></span>
                <span className={ui.badge}>
                  Skill · {entry.visibility === "official" ? "官方精选" : "我的私有"} · v{entry.version}
                </span>
              </div>
              <div>
                <h2 className={ui.cardTitle}>{entry.title}</h2>
                <p className={ui.cardText}>{entry.description}</p>
              </div>
              <div className={styles.entryFoot}>
                <span className={ui.meta}>输入：{entry.inputHint}</span>
                <button className={ui.buttonQuiet} onClick={() => openEntry(entry)}>
                  在 Agent 使用 <ArrowUpRight size={13} />
                </button>
              </div>
              {entry.ownerId === user?.id && (
                <div className={styles.manage}>
                  <button onClick={() => edit(entry)}>编辑</button>
                  <button onClick={() => void remove(entry)}>删除</button>
                </div>
              )}
            </article>
          ))}
        </div>
        {!visible.length && (
          <div className={ui.empty}>
            {query.trim()
              ? "没有找到匹配的 Skill，试试其他关键词。"
              : filter === "mine"
                ? "还没有自己的 Skill，可以从右上角创建。"
                : "这里暂时没有 Skill，可以先创建自己的方法。"}
          </div>
        )}
        {formOpen && (
          <div className={styles.overlay} onClick={() => setFormOpen(false)}>
            <section className={styles.editor} onClick={(event) => event.stopPropagation()}>
              <div className={ui.rowBetween}>
                <div>
                  <span className={ui.eyebrow}>MY CREATION</span>
                  <h2 className={styles.editorTitle}>{editingId ? "编辑 Skill" : "创建 Skill"}</h2>
                </div>
                <button onClick={() => setFormOpen(false)}>
                  <X size={18} />
                </button>
              </div>
              <div className={styles.fields}>
                <label>
                  <span className={ui.label}>名称</span>
                  <input
                    className={ui.input}
                    value={form.title}
                    onChange={(event) => setForm({ ...form, title: event.target.value })}
                    placeholder="清楚说明适用任务"
                  />
                </label>
                <label>
                  <span className={ui.label}>简介</span>
                  <input
                    className={ui.input}
                    value={form.description}
                    onChange={(event) => setForm({ ...form, description: event.target.value })}
                    placeholder="用户将得到什么结果"
                  />
                </label>
                <label>
                  <span className={ui.label}>所需输入</span>
                  <input
                    className={ui.input}
                    value={form.inputHint}
                    onChange={(event) => setForm({ ...form, inputHint: event.target.value })}
                  />
                </label>
                <label>
                  <span className={ui.label}>Skill 方法说明</span>
                  <textarea
                    className={ui.textarea}
                    value={form.content}
                    onChange={(event) => setForm({ ...form, content: event.target.value })}
                    placeholder="说明步骤、输入输出与注意事项"
                  />
                </label>
              </div>
              <div className={ui.rowBetween}>
                <span className={ui.meta}>私有保存 · 可在 Agent 中使用 · 每次修改保留版本号</span>
                <button className={ui.button} onClick={() => void save()}>
                  保存 Skill
                </button>
              </div>
            </section>
          </div>
        )}
      </div>
    </AppShell>
  );
}
