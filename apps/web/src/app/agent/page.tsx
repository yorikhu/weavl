"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArrowUp, Bot, Box, FileText, FolderPlus, Paperclip, Plus, Search, X } from "lucide-react";
import type { AgentConversation, Asset, CanvasProject, MarketEntry, ModelKind } from "@weavl/shared";
import { AppShell } from "@/components/AppShell";
import { ComposerTextarea } from "@/components/ComposerTextarea";
import { jsonBody, studioApi } from "@/lib/studioApi";
import { openCanvasAfter } from "@/utils/openCanvas";
import ui from "@/styles/studio.module.scss";
import styles from "./page.module.scss";

type AgentStart = {
  prompt: string;
  assetIds: string[];
  marketEntryIds?: string[];
  modelKinds?: ModelKind[];
  marketEntryId?: string;
  modelKind?: ModelKind;
  auto: boolean;
};
const modelOptions: { id: ModelKind; label: string }[] = [
  { id: "text", label: "文本模型" },
  { id: "image", label: "图片模型" },
  { id: "video", label: "视频模型" },
  { id: "audio", label: "音频模型" },
  { id: "avatar", label: "数字人模型" },
];

export default function AgentPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState<AgentConversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [market, setMarket] = useState<MarketEntry[]>([]);
  const [assetIds, setAssetIds] = useState<string[]>([]);
  const [methodIds, setMethodIds] = useState<string[]>([]);
  const [modelKinds, setModelKinds] = useState<ModelKind[]>([]);
  const [showAssets, setShowAssets] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const pendingRef = useRef(false);
  const selected = conversations.find((item) => item.id === selectedId) || null;
  const visible = useMemo(
    () =>
      conversations.filter(
        (item) => item.archived === showArchive && item.title.toLowerCase().includes(search.toLowerCase()),
      ),
    [conversations, search, showArchive],
  );

  const refresh = useCallback(async () => {
    try {
      const [chats, files, methods] = await Promise.all([
        studioApi<AgentConversation[]>("/studio/conversations"),
        studioApi<Asset[]>("/studio/assets"),
        studioApi<MarketEntry[]>("/studio/market"),
      ]);
      setConversations(chats);
      setAssets(files);
      setMarket(methods);
      return chats;
    } catch (cause) {
      setError((cause as Error).message);
      return [];
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    const selectedMethod = sessionStorage.getItem("weavl:market-id");
    if (selectedMethod) {
      setMethodIds((current) => [...new Set([...current, selectedMethod])]);
      sessionStorage.removeItem("weavl:market-id");
    }
  }, []);
  useEffect(() => {
    const selectedAsset = sessionStorage.getItem("weavl:agent-asset-id");
    if (selectedAsset) {
      setAssetIds([selectedAsset]);
      sessionStorage.removeItem("weavl:agent-asset-id");
    }
  }, []);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selected?.messages.length, busy]);

  useEffect(() => {
    if (pendingRef.current) return;
    const launch = sessionStorage.getItem("weavl:agent-start");
    const legacyPrompt = sessionStorage.getItem("weavl:agent-prompt");
    if (!launch && !legacyPrompt) return;
    pendingRef.current = true;
    sessionStorage.removeItem("weavl:agent-start");
    sessionStorage.removeItem("weavl:agent-prompt");
    const start: AgentStart = launch
      ? JSON.parse(launch)
      : { prompt: legacyPrompt || "", assetIds: [], auto: true };
    const startMethodIds = start.marketEntryIds || (start.marketEntryId ? [start.marketEntryId] : []);
    const startModelKinds = start.modelKinds || (start.modelKind ? [start.modelKind] : []);
    setMethodIds(startMethodIds);
    setModelKinds(startModelKinds);
    if (!start.auto || !start.prompt.trim()) {
      setDraft(start.prompt);
      setAssetIds(start.assetIds);
      return;
    }
    void (async () => {
      try {
        const created = await studioApi<AgentConversation>("/studio/conversations", {
          method: "POST",
          body: jsonBody({ title: start.prompt.slice(0, 35) }),
        });
        setSelectedId(created.id);
        setBusy(true);
        await studioApi(`/studio/conversations/${created.id}/messages`, {
          method: "POST",
          body: jsonBody({ content: start.prompt, assetIds: start.assetIds, marketEntryIds: startMethodIds, modelKinds: startModelKinds }),
        });
        await refresh();
      } catch (cause) {
        setError((cause as Error).message);
        setDraft(start.prompt);
        setAssetIds(start.assetIds);
      } finally {
        setBusy(false);
      }
    })();
  }, [refresh]);

  async function send() {
    const text = draft.trim();
    if (!text || busy) return;
    setBusy(true);
    setError("");
    try {
      let id = selectedId;
      if (!id) {
        const created = await studioApi<AgentConversation>("/studio/conversations", {
          method: "POST",
          body: jsonBody({ title: text.slice(0, 35) }),
        });
        id = created.id;
        setSelectedId(id);
      }
      setDraft("");
      await studioApi(`/studio/conversations/${id}/messages`, {
        method: "POST",
        body: jsonBody({ content: text, assetIds, marketEntryIds: methodIds, modelKinds }),
      });
      setAssetIds([]);
      setMethodIds([]);
      await refresh();
    } catch (cause) {
      setError((cause as Error).message);
      setDraft(text);
    } finally {
      setBusy(false);
    }
  }

  async function updateConversation(id: string, value: Record<string, unknown>) {
    try {
      await studioApi(`/studio/conversations/${id}`, { method: "PATCH", body: jsonBody(value) });
      await refresh();
      if (value.archived) setSelectedId(null);
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  async function createProject() {
    if (!selected) return;
    const ids = [...new Set(selected.messages.flatMap((message) => message.assetRefs.map((ref) => ref.assetId)))];
    if (!ids.length) {
      setError("这个会话还没有可加入画布的产物。");
      return;
    }
    const chosen = ids.filter((id) =>
      window.confirm(`将「${assets.find((asset) => asset.id === id)?.name || "资产"}」加入新项目？`),
    );
    if (!chosen.length) return;
    try {
      await openCanvasAfter(async () => {
        const project = await studioApi<CanvasProject>(`/studio/conversations/${selected.id}/project`, {
          method: "POST",
          body: jsonBody({ assetIds: chosen }),
        });
        return { projectId: project.id, canvasId: project.canvases[0]!.id };
      });
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  return (
    <AppShell>
      <div className={styles.layout}>
        <aside className={styles.history}>
          <div className={ui.rowBetween}>
            <span className={ui.eyebrow}>CONVERSATIONS</span>
            <button
              className={styles.iconButton}
              title="新建会话"
              onClick={() => {
                setSelectedId(null);
                setDraft("");
              }}
            >
              <Plus size={18} />
            </button>
          </div>
          <label className={styles.search}>
            <Search size={14} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索会话" />
          </label>
          <button
            className={styles.archiveToggle}
            onClick={() => {
              setShowArchive((value) => !value);
              setSelectedId(null);
            }}
          >
            {showArchive ? "返回近期会话" : "查看归档会话"}
          </button>
          <div className={styles.historyList}>
            {visible.map((chat) => (
              <button
                key={chat.id}
                className={`${styles.historyItem} ${selectedId === chat.id ? styles.historyActive : ""}`}
                onClick={() => setSelectedId(chat.id)}
              >
                <span>{chat.title}</span>
                <small>{new Date(chat.updatedAt).toLocaleDateString("zh-CN")}</small>
              </button>
            ))}
          </div>
        </aside>
        <section className={styles.chat}>
          <header className={styles.chatHead}>
            <div>
              <span className={ui.eyebrow}>WEAVL AGENT</span>
              <h1>{selected?.title || "开始新的对话"}</h1>
            </div>
            <div className={ui.row}>
              {selected && (
                <>
                  <button
                    className={ui.buttonQuiet}
                    title="重命名"
                    onClick={() => {
                      const name = window.prompt("会话名称", selected.title);
                      if (name?.trim()) void updateConversation(selected.id, { title: name.trim() });
                    }}
                  >
                    重命名
                  </button>
                  <button className={ui.buttonQuiet} onClick={() => void createProject()}>
                    <FolderPlus size={14} />
                    创建项目
                  </button>
                  <button
                    className={styles.iconButton}
                    title="归档"
                    onClick={() => void updateConversation(selected.id, { archived: !selected.archived })}
                  >
                    <Archive size={16} />
                  </button>
                </>
              )}
            </div>
          </header>
          <div className={styles.messages}>
            {!selected || selected.messages.length === 0 ? (
              <div className={styles.welcome}>
                <span className={styles.mark}>
                  <Bot size={22} strokeWidth={1.4} />
                </span>
                <h2>从一个想法开始</h2>
                <p>描述你想完成的内容，或选取 Skill 和已有资产。当前为可保存结果的本地模拟 Agent。</p>
                <div className={styles.suggestions}>
                  {["把访谈资料整理成人物定位", "写一版适合拍摄的口播脚本", "根据周报提炼三条关键进展"].map((idea) => (
                    <button key={idea} onClick={() => setDraft(idea)}>
                      {idea}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              selected.messages.map((message) => (
                <article
                  key={message.id}
                  className={`${styles.message} ${message.role === "user" ? styles.userMessage : ""}`}
                >
                  <div className={styles.messageAuthor}>{message.role === "user" ? "你" : "Weavl Agent"}</div>
                  <div className={styles.messageText}>{message.content}</div>
                  {message.assetRefs.length > 0 && (
                    <div className={styles.resultList}>
                      {message.assetRefs.map((ref) => {
                        const asset = assets.find((item) => item.id === ref.assetId);
                        return (
                          <button key={ref.versionId} className={styles.result} onClick={() => router.push("/assets")}>
                            <FileText size={15} />
                            <span>{asset?.name || "已保存的产物"}</span>
                            <small>资产 v{asset?.versions.length || 1}</small>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </article>
              ))
            )}
            {busy && <div className={styles.thinking}>正在生成模拟草稿…</div>}
            <div ref={bottomRef} />
          </div>
          <div className={styles.composerWrap}>
            {error && <p className={ui.error}>{error}</p>}
            {showAssets && (
              <div className={styles.assetPicker}>
                <div className={ui.rowBetween}>
                  <strong>引用资产</strong>
                  <button onClick={() => setShowAssets(false)}>
                    <X size={15} />
                  </button>
                </div>
                {assets.length === 0 ? (
                  <p>资产库为空。先上传资料即可在这里引用。</p>
                ) : (
                  assets.map((asset) => (
                    <label key={asset.id}>
                      <input
                        type="checkbox"
                        checked={assetIds.includes(asset.id)}
                        onChange={(event) =>
                          setAssetIds((current) =>
                            event.target.checked ? [...current, asset.id] : current.filter((id) => id !== asset.id),
                          )
                        }
                      />
                      {asset.name} <small>{asset.source}</small>
                    </label>
                  ))
                )}
              </div>
            )}
            <div className={styles.composer}>
              <ComposerTextarea
                value={draft}
                onValueChange={setDraft}
                onSubmit={() => void send()}
                placeholder="告诉 Weavl Agent 你想完成什么…"
                title="Enter 发送；Shift / Ctrl / Command + Enter 换行"
                rows={3}
              />
              <div className={ui.rowBetween}>
                <div className={`${ui.row} ${styles.composerControls}`}>
                  <button className={styles.toolButton} onClick={() => setShowAssets((value) => !value)}>
                    <Paperclip size={14} />
                    {assetIds.length ? `${assetIds.length} 份资产` : "添加资产"}
                  </button>
                  <select
                    className={styles.methodSelect}
                    aria-label="添加 Skill"
                    value=""
                    onChange={(event) => {
                      const id = event.target.value;
                      if (id) setMethodIds((current) => current.includes(id) ? current : [...current, id]);
                    }}
                  >
                    <option value="">{methodIds.length ? `已选 ${methodIds.length} 个 Skill` : "添加 Skill"}</option>
                    {market.map((entry) => (
                      <option key={entry.id} value={entry.id} disabled={methodIds.includes(entry.id)}>
                          Skill · {entry.title}
                      </option>
                    ))}
                  </select>
                  <select
                    className={styles.methodSelect}
                    aria-label="添加模型"
                    value=""
                    onChange={(event) => {
                      const id = event.target.value as ModelKind;
                      if (id) setModelKinds((current) => current.includes(id) ? current : [...current, id]);
                    }}
                  >
                    <option value="">{modelKinds.length ? `已选 ${modelKinds.length} 个模型` : "添加模型（默认文本）"}</option>
                    {modelOptions.map((option) => (
                      <option key={option.id} value={option.id} disabled={modelKinds.includes(option.id)}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <button
                  className={styles.send}
                  title="发送"
                  disabled={!draft.trim() || busy}
                  onClick={() => void send()}
                >
                  <ArrowUp size={17} />
                </button>
              </div>
              {(methodIds.length > 0 || modelKinds.length > 0) && (
                <div className={styles.selectionChips}>
                  {modelKinds.map((id) => (
                    <span key={`model-${id}`} className={styles.selectionChip}>
                      <Box size={12} />{modelOptions.find((option) => option.id === id)?.label || id}
                      <button type="button" aria-label={`移除${id}模型`} onClick={() => setModelKinds((current) => current.filter((item) => item !== id))}><X size={12} /></button>
                    </span>
                  ))}
                  {methodIds.map((id) => (
                    <span key={`skill-${id}`} className={styles.selectionChip}>
                      Skill · {market.find((entry) => entry.id === id)?.title || "已选方法"}
                      <button type="button" aria-label="移除 Skill" onClick={() => setMethodIds((current) => current.filter((item) => item !== id))}><X size={12} /></button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <p className={styles.disclaimer}>
              模拟模式：内容由本地模板生成并保存，可用于验证完整交互；模型接入后替换服务适配器。
            </p>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
