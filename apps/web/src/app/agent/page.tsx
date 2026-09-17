"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArrowUp,
  AudioLines,
  Bot,
  Box,
  Check,
  Clapperboard,
  FileText,
  FolderPlus,
  Image,
  Paperclip,
  Plus,
  Search,
  Settings2,
  UserRound,
  Wrench,
} from "lucide-react";
import type { AgentConversation, Asset, CanvasProject, MarketEntry, ModelKind } from "@weavl/shared";
import { AppShell } from "@/components/AppShell";
import { Popover } from "@/components/Popover";
import { InlineComposer, type ComposerToken, type InlineComposerHandle } from "@/components/InlineComposer";
import { Form } from "@/components/Form";
import { jsonBody, studioApi } from "@/lib/studioApi";
import { openCanvasAfter } from "@/utils/openCanvas";
import { uploadAsset } from "@/utils/uploadAsset";
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
const modelOptions = [
  { id: "text", label: "文本模型", detail: "文案、策划、结构化内容", icon: FileText },
  { id: "image", label: "图片模型", detail: "视觉概念与图片生成", icon: Image },
  { id: "video", label: "视频模型", detail: "分镜与视频生成", icon: Clapperboard },
  { id: "audio", label: "音频模型", detail: "配音、音乐与音效", icon: AudioLines },
  { id: "avatar", label: "数字人模型", detail: "形象与口播内容", icon: UserRound },
] as const;
const composerTools = [
  { id: "attachments", label: "插入附件", icon: Paperclip },
  { id: "model", label: "插入模型", icon: Box },
  { id: "skill", label: "插入 Skill", icon: Wrench },
  { id: "mode", label: "选择模式", icon: Settings2 },
] as const;
type ComposerTool = (typeof composerTools)[number]["id"];
type CreationMode = "auto" | "manual";
function removeFirst<T>(items: T[], value: T): T[] {
  const index = items.indexOf(value);
  return index < 0 ? items : items.filter((_, itemIndex) => itemIndex !== index);
}

/**
 * 渲染 Agent 会话工作台。
 *
 * @returns Agent 会话页面。
 */
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
  const [mode, setMode] = useState<CreationMode>("auto");
  const [openTool, setOpenTool] = useState<ComposerTool | null>(null);
  const [toolSearch, setToolSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [catalogReady, setCatalogReady] = useState(false);
  const [pendingTokens, setPendingTokens] = useState<{
    assetIds: string[];
    methodIds: string[];
    modelKinds: ModelKind[];
  } | null>(null);
  const [showArchive, setShowArchive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const pendingRef = useRef(false);
  const composerRef = useRef<InlineComposerHandle>(null);
  const fileRef = useRef<HTMLInputElement>(null);
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
        studioApi<Asset[]>("/studio/assets?includeGenerated=1"),
        studioApi<MarketEntry[]>("/studio/market"),
      ]);
      setConversations(chats);
      setAssets(files);
      setMarket(methods);
      setCatalogReady(true);
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
      setPendingTokens((current) => ({
        assetIds: current?.assetIds || [],
        methodIds: [...(current?.methodIds || []), selectedMethod],
        modelKinds: current?.modelKinds || [],
      }));
      sessionStorage.removeItem("weavl:market-id");
    }
  }, []);
  useEffect(() => {
    const selectedAsset = sessionStorage.getItem("weavl:agent-asset-id");
    if (selectedAsset) {
      setAssetIds([selectedAsset]);
      setPendingTokens((current) => ({
        assetIds: [...(current?.assetIds || []), selectedAsset],
        methodIds: current?.methodIds || [],
        modelKinds: current?.modelKinds || [],
      }));
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
    const start: AgentStart = launch ? JSON.parse(launch) : { prompt: legacyPrompt || "", assetIds: [], auto: true };
    const startMethodIds = start.marketEntryIds || (start.marketEntryId ? [start.marketEntryId] : []);
    const startModelKinds = start.modelKinds || (start.modelKind ? [start.modelKind] : []);
    if (!start.auto || !start.prompt.trim()) {
      setDraft(start.prompt);
      setAssetIds(start.assetIds);
      setMethodIds(startMethodIds);
      setModelKinds(startModelKinds);
      setMode("manual");
      setPendingTokens({ assetIds: start.assetIds, methodIds: startMethodIds, modelKinds: startModelKinds });
      return;
    }
    setAssetIds([]);
    setMethodIds([]);
    setModelKinds([]);
    setPendingTokens(null);
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
          body: jsonBody({
            content: start.prompt,
            assetIds: [...new Set(start.assetIds)],
            marketEntryIds: [...new Set(startMethodIds)],
            modelKinds: [...new Set(startModelKinds)],
          }),
        });
        await refresh();
      } catch (cause) {
        setError((cause as Error).message);
        setDraft(start.prompt);
        setAssetIds(start.assetIds);
        setMethodIds(startMethodIds);
        setModelKinds(startModelKinds);
        setPendingTokens({ assetIds: start.assetIds, methodIds: startMethodIds, modelKinds: startModelKinds });
      } finally {
        setBusy(false);
      }
    })();
  }, [refresh]);

  useEffect(() => {
    if (!catalogReady || !pendingTokens) return;
    for (const id of pendingTokens.assetIds) {
      composerRef.current?.insertToken(
        { type: "asset", id, label: assets.find((asset) => asset.id === id)?.name || "资产" },
        false,
      );
    }
    for (const id of pendingTokens.methodIds) {
      composerRef.current?.insertToken(
        { type: "skill", id, label: market.find((entry) => entry.id === id)?.title || "Skill" },
        false,
      );
    }
    for (const id of pendingTokens.modelKinds) {
      composerRef.current?.insertToken(
        { type: "model", id, label: modelOptions.find((option) => option.id === id)?.label || "模型" },
        false,
      );
    }
    setPendingTokens(null);
  }, [catalogReady, pendingTokens, assets, market]);

  async function send() {
    const text = draft.trim();
    if (!text || busy || uploading) return;
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
      await studioApi(`/studio/conversations/${id}/messages`, {
        method: "POST",
        body: jsonBody({
          content: text,
          assetIds: [...new Set(assetIds)],
          marketEntryIds: [...new Set(methodIds)],
          modelKinds: [...new Set(modelKinds)],
        }),
      });
      composerRef.current?.clear();
      setDraft("");
      setAssetIds([]);
      setMethodIds([]);
      setModelKinds([]);
      await refresh();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function removeToken(token: ComposerToken) {
    if (token.type === "asset") setAssetIds((current) => removeFirst(current, token.id));
    if (token.type === "skill") setMethodIds((current) => removeFirst(current, token.id));
    if (token.type === "model") setModelKinds((current) => removeFirst(current, token.id as ModelKind));
  }

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setError("");
    try {
      for (const file of Array.from(files)) {
        const asset = await uploadAsset(file, null, false);
        setAssets((current) => [asset, ...current]);
        setAssetIds((current) => [...current, asset.id]);
        composerRef.current?.insertToken({ type: "asset", id: asset.id, label: asset.name });
      }
      setOpenTool(null);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function renderToolContent(tool: ComposerTool) {
    if (tool === "model") {
      return (
        <div className={styles.toolMenu}>
          <strong>插入模型</strong>
          <div className={styles.menuList}>
            {modelOptions.map((model) => {
              const Icon = model.icon;
              return (
                <button
                  key={model.id}
                  type="button"
                  className={styles.menuItem}
                  onClick={() => {
                    composerRef.current?.insertToken({ type: "model", id: model.id, label: model.label }, false);
                    setModelKinds((current) => [...current, model.id]);
                  }}
                >
                  <Icon size={15} />
                  <span>
                    {model.label}
                    <small>{model.detail}</small>
                  </span>
                </button>
              );
            })}
          </div>
          <p>选择内容类型，Agent 会根据当前任务组织输出。</p>
        </div>
      );
    }
    if (tool === "mode") {
      return (
        <div className={styles.toolMenu}>
          <strong>输入模式</strong>
          {(
            [
              { id: "auto", title: "自动", detail: "Enter 发送，组合键换行" },
              { id: "manual", title: "手动", detail: "Enter 换行，点击按钮发送" },
            ] as const
          ).map((option) => (
            <button
              key={option.id}
              type="button"
              className={`${styles.menuItem} ${mode === option.id ? styles.menuItemSelected : ""}`}
              onClick={() => {
                setMode(option.id);
                setOpenTool(null);
              }}
            >
              <span>
                {option.title}
                <small>{option.detail}</small>
              </span>
              {mode === option.id && <Check size={14} />}
            </button>
          ))}
        </div>
      );
    }
    if (tool === "attachments") {
      return (
        <div className={styles.toolMenu}>
          <strong>插入附件</strong>
          <button
            type="button"
            className={styles.menuItem}
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            <Paperclip size={15} />
            <span>
              {uploading ? "正在上传…" : "从电脑上传"}
              <small>单个文件不超过 5 MB</small>
            </span>
          </button>
          <div className={styles.menuDivider} />
          <span className={styles.menuCaption}>已有资产</span>
          <div className={styles.menuList}>
            {assets.length ? (
              assets.filter((asset) => asset.inLibrary !== false).map((asset) => (
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
              ))
            ) : (
              <p>还没有资产。可以先上传一份资料。</p>
            )}
          </div>
        </div>
      );
    }
    const entries = market.filter((entry) =>
      `${entry.title} ${entry.description}`.toLowerCase().includes(toolSearch.toLowerCase()),
    );
    return (
      <div className={styles.toolMenu}>
        <strong>插入 Skill</strong>
        <Form.Input
          className={styles.menuSearch}
          value={toolSearch}
          onChange={(event) => setToolSearch(event.target.value)}
          placeholder="搜索 Skill"
          aria-label="搜索 Skill"
        />
        <div className={styles.menuList}>
          {entries.length ? (
            entries.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className={styles.menuItem}
                onClick={() => {
                  composerRef.current?.insertToken({ type: "skill", id: entry.id, label: entry.title }, false);
                  setMethodIds((current) => [...current, entry.id]);
                }}
              >
                <span>
                  {entry.title}
                  <small>{entry.description}</small>
                </span>
              </button>
            ))
          ) : (
            <p>没有找到可用的 Skill。</p>
          )}
        </div>
      </div>
    );
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
                composerRef.current?.clear();
                setDraft("");
                setAssetIds([]);
                setMethodIds([]);
                setModelKinds([]);
                setPendingTokens(null);
                setMode("auto");
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
                          <button
                            key={ref.versionId}
                            className={styles.result}
                            onClick={() => {
                              if (!asset || asset.inLibrary !== false) {
                                router.push("/assets");
                                return;
                              }
                              void studioApi<Asset>(`/studio/assets/${asset.id}`, {
                                method: "PATCH",
                                body: jsonBody({ inLibrary: true }),
                              })
                                .then(() => refresh())
                                .catch((cause) => setError((cause as Error).message));
                            }}
                          >
                            <FileText size={15} />
                            <span>{asset?.name || "会话产物"}</span>
                            <small>{asset?.inLibrary === false ? "保存到资产" : `资产 v${asset?.versions.length || 1}`}</small>
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
            <div className={styles.composer}>
              <InlineComposer
                ref={composerRef}
                value={draft}
                onValueChange={setDraft}
                onTokenRemove={removeToken}
                onTokenRestore={(token) => {
                  if (token.type === "asset") setAssetIds((current) => [...current, token.id]);
                  if (token.type === "skill") setMethodIds((current) => [...current, token.id]);
                  if (token.type === "model") setModelKinds((current) => [...current, token.id as ModelKind]);
                }}
                onSubmit={() => void send()}
                placeholder="告诉 Weavl Agent 你想完成什么…"
                ariaLabel="告诉 Weavl Agent 你想完成什么"
                submitOnEnter={mode === "auto"}
                disabled={busy}
              />
              <input
                ref={fileRef}
                type="file"
                multiple
                hidden
                onChange={(event) => void addFiles(event.target.files)}
              />
              <div className={styles.composerFooter}>
                <div className={styles.composerTools}>
                  {composerTools.map((tool) => {
                    const Icon = tool.icon;
                    return (
                      <Popover variant="action"
                        key={tool.id}
                        hint={tool.label}
                        open={openTool === tool.id}
                        onOpenChange={(open) => {
                          setOpenTool(open ? tool.id : null);
                          if (open) setToolSearch("");
                        }}
                        trigger={
                          <button
                            type="button"
                            className={`${styles.toolButton} ${tool.id === "mode" && mode === "manual" ? styles.toolButtonActive : ""}`}
                            aria-label={tool.label}
                          >
                            <Icon size={15} strokeWidth={1.7} />
                          </button>
                        }
                      >
                        {renderToolContent(tool.id)}
                      </Popover>
                    );
                  })}
                  <span className={styles.modeLabel}>{mode === "auto" ? "自动" : "手动"} · 模拟</span>
                </div>
                <Popover variant="action"
                  mode="hover"
                  trigger={
                    <button
                      type="button"
                      className={styles.send}
                      aria-label="发送"
                      disabled={!draft.trim() || busy || uploading}
                      onClick={() => void send()}
                    >
                      <ArrowUp size={17} />
                    </button>
                  }
                >
                  发送
                </Popover>
              </div>
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
