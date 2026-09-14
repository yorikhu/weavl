"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, File, Folder, FolderPlus, Image as ImageIcon, Plus, Search, Trash2, X } from "lucide-react";
import NextImage from "next/image";
import type { Asset, AssetSource, CanvasProject, Folder as AssetFolder } from "@weavl/shared";
import { AppShell } from "@/components/AppShell";
import { jsonBody, studioApi } from "@/lib/studioApi";
import ui from "@/styles/studio.module.scss";
import { assetToCanvasNode } from "@/utils/assetNode";
import { openCanvasAfter } from "@/utils/openCanvas";
import { uploadAsset } from "@/utils/uploadAsset";
import styles from "./page.module.scss";

const sources: { key: "all" | AssetSource | "trash"; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "personal", label: "个人上传" },
  { key: "agent", label: "Agent" },
  { key: "workflow", label: "工作流" },
  { key: "canvas", label: "画布" },
  { key: "trash", label: "回收站" },
];

export default function AssetsPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [folders, setFolders] = useState<AssetFolder[]>([]);
  const [projects, setProjects] = useState<CanvasProject[]>([]);
  const [source, setSource] = useState<(typeof sources)[number]["key"]>("all");
  const [folderId, setFolderId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState<Asset | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    try {
      const [items, dirs, projectItems] = await Promise.all([
        studioApi<Asset[]>(
          `/studio/assets?trash=${source === "trash" ? "1" : "0"}${source !== "all" && source !== "trash" ? `&source=${source}` : ""}`,
        ),
        studioApi<AssetFolder[]>("/studio/folders"),
        studioApi<CanvasProject[]>("/studio/projects"),
      ]);
      setAssets(items);
      setFolders(dirs);
      setProjects(projectItems);
    } catch (cause) {
      setError((cause as Error).message);
    }
  }, [source]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const visible = useMemo(
    () =>
      assets.filter(
        (asset) => (!folderId || asset.folderId === folderId) && asset.name.toLowerCase().includes(query.toLowerCase()),
      ),
    [assets, folderId, query],
  );

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError("");
    try {
      for (const file of Array.from(files)) {
        await uploadAsset(file, folderId);
      }
      await refresh();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function createFolder() {
    const name = window.prompt("文件夹名称");
    if (!name?.trim()) return;
    try {
      await studioApi("/studio/folders", { method: "POST", body: jsonBody({ name: name.trim(), parentId: folderId }) });
      await refresh();
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  async function changeAsset(asset: Asset, update: Record<string, unknown>) {
    try {
      await studioApi(`/studio/assets/${asset.id}`, { method: "PATCH", body: jsonBody(update) });
      await refresh();
      setPreview(null);
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  async function addToCanvas(asset: Asset) {
    if (!projects.length) {
      router.push("/projects");
      return;
    }
    const project = projects[0]!;
    const canvas = project.canvases[0]!;
    try {
      await openCanvasAfter(async () => {
        const latest = await studioApi<CanvasProject>(`/studio/projects/${project.id}`);
        const currentCanvas = latest.canvases.find((item) => item.id === canvas.id) || canvas;
        const nodes = [...currentCanvas.nodes, assetToCanvasNode(asset, currentCanvas.nodes.length)];
        await studioApi(`/studio/projects/${project.id}/canvases/${canvas.id}`, {
          method: "PATCH",
          body: jsonBody({ nodes }),
        });
        return { projectId: project.id, canvasId: canvas.id };
      });
      await refresh();
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  const version = preview?.versions.at(-1);
  return (
    <AppShell>
      <div className={ui.page}>
        <header className={ui.header}>
          <div>
            <span className={ui.eyebrow}>SHARED ASSETS</span>
            <h1 className={ui.title}>资产</h1>
            <p className={ui.description}>所有内容的共同归处。移动文件夹不会改变来源，也不会打断画布与会话中的引用。</p>
          </div>
          <div className={ui.row}>
            <button className={ui.buttonQuiet} onClick={() => void createFolder()}>
              <FolderPlus size={14} />
              新建文件夹
            </button>
            <button className={ui.button} onClick={() => fileRef.current?.click()} disabled={busy}>
              <Plus size={14} />
              {busy ? "上传中…" : "上传文件"}
            </button>
            <input ref={fileRef} type="file" multiple hidden onChange={(event) => void upload(event.target.files)} />
          </div>
        </header>
        <div className={styles.layout}>
          <aside className={styles.sidebar}>
            <button
              className={`${styles.folderItem} ${folderId === null ? styles.folderActive : ""}`}
              onClick={() => setFolderId(null)}
            >
              <Folder size={15} />
              全部文件夹
            </button>
            {folders.map((folder) => (
              <button
                key={folder.id}
                className={`${styles.folderItem} ${folderId === folder.id ? styles.folderActive : ""}`}
                onClick={() => setFolderId(folder.id)}
              >
                <Folder size={15} />
                {folder.name}
              </button>
            ))}
          </aside>
          <section className={styles.content}>
            <div className={styles.toolbar}>
              <div className={ui.tabs}>
                {sources.map((item) => (
                  <button
                    key={item.key}
                    className={`${ui.tab} ${source === item.key ? ui.tabActive : ""}`}
                    onClick={() => setSource(item.key)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <label className={styles.search}>
                <Search size={14} />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索资产" />
              </label>
            </div>
            {error && <p className={ui.error}>{error}</p>}
            {visible.length === 0 ? (
              <div className={ui.empty}>这里还没有资产。上传文件，或从 Agent 和工作流生成内容。</div>
            ) : (
              <div className={styles.assetGrid}>
                {visible.map((asset) => (
                  <button className={`${ui.card} ${styles.assetCard}`} key={asset.id} onClick={() => setPreview(asset)}>
                    <span className={styles.assetIcon}>
                      {asset.kind === "image" ? (
                        <ImageIcon size={22} strokeWidth={1.4} />
                      ) : (
                        <File size={22} strokeWidth={1.4} />
                      )}
                    </span>
                    <span className={styles.assetName}>{asset.name}</span>
                    <span className={ui.meta}>
                      {asset.source} · v{asset.versions.length} ·{" "}
                      {new Date(asset.updatedAt).toLocaleDateString("zh-CN")}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
        {preview && (
          <div className={styles.overlay} onClick={() => setPreview(null)}>
            <section className={styles.preview} onClick={(event) => event.stopPropagation()}>
              <div className={ui.rowBetween}>
                <div>
                  <h2 className={ui.cardTitle}>{preview.name}</h2>
                  <p className={ui.cardText}>
                    {preview.kind.toUpperCase()} · 来源 {preview.source} · {preview.versions.length} 个版本
                  </p>
                </div>
                <button onClick={() => setPreview(null)}>
                  <X size={18} />
                </button>
              </div>
              <div className={styles.previewBody}>
                {preview.kind === "image" && version?.content.startsWith("data:") ? (
                  <NextImage src={version.content} alt={preview.name} width={620} height={440} unoptimized />
                ) : preview.kind === "video" && version?.content.startsWith("data:") ? (
                  <video src={version.content} controls />
                ) : preview.kind === "audio" && version?.content.startsWith("data:") ? (
                  <audio src={version.content} controls />
                ) : preview.kind === "pdf" && version?.content.startsWith("data:") ? (
                  <iframe src={version.content} title={preview.name} />
                ) : version?.content.startsWith("data:") ? (
                  <p>此格式暂无内置预览，可以下载原文件。</p>
                ) : (
                  <pre>{version?.content}</pre>
                )}
              </div>
              <div className={styles.actions}>
                <select
                  className={ui.select}
                  value={preview.folderId || ""}
                  onChange={(event) => void changeAsset(preview, { folderId: event.target.value || null })}
                >
                  <option value="">未分类</option>
                  {folders.map((folder) => (
                    <option value={folder.id} key={folder.id}>
                      {folder.name}
                    </option>
                  ))}
                </select>
                <button
                  className={ui.buttonQuiet}
                  onClick={() => {
                    const next = window.prompt("资产名称", preview.name);
                    if (next?.trim()) void changeAsset(preview, { name: next.trim() });
                  }}
                >
                  重命名
                </button>
                <button className={ui.buttonQuiet} onClick={() => void addToCanvas(preview)}>
                  加入画布
                </button>
                <a
                  className={ui.buttonQuiet}
                  href={
                    version?.content.startsWith("data:")
                      ? version.content
                      : `data:text/plain;charset=utf-8,${encodeURIComponent(version?.content || "")}`
                  }
                  download={preview.name}
                >
                  <Download size={14} />
                  下载
                </a>
                {preview.deletedAt ? (
                  <button
                    className={ui.button}
                    onClick={() => {
                      void studioApi(`/studio/assets/${preview.id}/restore`, { method: "POST" }).then(() => {
                        setPreview(null);
                        void refresh();
                      });
                    }}
                  >
                    恢复
                  </button>
                ) : (
                  <button
                    className={ui.buttonDanger}
                    onClick={() => {
                      if (window.confirm("移到回收站？项目中的引用将保留，但资产暂不可选用。"))
                        void studioApi(`/studio/assets/${preview.id}`, { method: "DELETE" }).then(() => {
                          setPreview(null);
                          void refresh();
                        });
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </AppShell>
  );
}
