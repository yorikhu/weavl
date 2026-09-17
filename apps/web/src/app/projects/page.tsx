"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Folder, FolderPlus, Layers, MoreHorizontal, Pencil, Plus, Search, Trash2 } from "lucide-react";
import type { CanvasProject, ProjectFolder } from "@weavl/shared";
import { AppShell } from "@/components/AppShell";
import { Popover } from "@/components/Popover";
import { Form } from "@/components/Form";
import { Modal } from "@/components/Modal";
import { toast } from "@/hooks/useToast";
import { jsonBody, studioApi } from "@/lib/studioApi";
import { canvasHref, openCanvasAfter } from "@/utils/openCanvas";
import { ProjectCard, type ProjectAction } from "./components/ProjectCard";
import ui from "@/styles/studio.module.scss";
import styles from "./page.module.scss";

type View = "all" | "unfiled" | "trash" | `folder:${string}`;
type Dialog = {
  kind: "create" | "folder" | "renameFolder" | "move";
  project?: CanvasProject;
  folder?: ProjectFolder;
};
type Confirmation =
  { kind: "deleteFolder"; folder: ProjectFolder } | { kind: "deleteProjectPermanently"; project: CanvasProject };
const dialogTitles: Record<Dialog["kind"], string> = {
  create: "新建项目",
  folder: "新建文件夹",
  renameFolder: "重命名文件夹",
  move: "移动项目",
};

function getEmptyMessage(query: string, view: View) {
  if (query.trim()) return "没有找到匹配的项目。";
  if (view === "trash") return "回收站是空的。";
  return "这里还没有项目，开始一次新的创作吧。";
}

const isOverflowing = (element: HTMLElement) => element.scrollWidth > element.clientWidth;

function getConfirmationCopy(confirmation: Confirmation) {
  if (confirmation.kind === "deleteFolder") {
    return {
      title: `删除文件夹「${confirmation.folder.name}」？`,
      description: "文件夹内的项目会移至未分类，项目内容不会被删除。",
      confirmLabel: "删除文件夹",
    };
  }
  return {
    title: `彻底删除「${confirmation.project.name}」？`,
    description: "项目及其中的画布将被永久删除，此操作无法撤销。",
    confirmLabel: "彻底删除",
  };
}

/**
 * 渲染项目管理页面。
 *
 * @returns 项目搜索、文件夹和回收站页面。
 */
export default function ProjectsPage() {
  const [projects, setProjects] = useState<CanvasProject[]>([]);
  const [trash, setTrash] = useState<CanvasProject[]>([]);
  const [folders, setFolders] = useState<ProjectFolder[]>([]);
  const [view, setView] = useState<View>("all");
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [dialogValue, setDialogValue] = useState("");
  const [folderMenuOpen, setFolderMenuOpen] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [error, setError] = useState("");
  const coverInputRef = useRef<HTMLInputElement>(null);
  const coverTargetRef = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [active, deleted, projectFolders] = await Promise.all([
        studioApi<CanvasProject[]>("/studio/projects"),
        studioApi<CanvasProject[]>("/studio/projects?trash=1"),
        studioApi<ProjectFolder[]>("/studio/projects/folders"),
      ]);
      setProjects(active);
      setTrash(deleted);
      setFolders(projectFolders);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const visible = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    return (view === "trash" ? trash : projects).filter((project) => {
      if (view === "unfiled" && project.folderId) return false;
      if (view.startsWith("folder:") && project.folderId !== view.slice(7)) return false;
      return !search || project.name.toLocaleLowerCase().includes(search);
    });
  }, [projects, trash, query, view]);

  function openDialog(kind: Dialog["kind"], project?: CanvasProject, folder?: ProjectFolder) {
    setError("");
    setDialog({ kind, project, folder });
    setDialogValue(kind === "move" ? project?.folderId || "" : kind === "renameFolder" ? folder?.name || "" : "");
  }

  async function submitDialog() {
    if (!dialog) return;
    setBusy(true);
    setError("");
    try {
      if (dialog.kind === "create") {
        await openCanvasAfter(async () => {
          const project = await studioApi<CanvasProject>("/studio/projects", {
            method: "POST",
            body: jsonBody({
              name: dialogValue.trim() || "未命名项目",
              folderId: view.startsWith("folder:") ? view.slice(7) : null,
            }),
          });
          return { projectId: project.id, canvasId: project.canvases[0]!.id };
        });
        if (view === "trash") setView("all");
        toast("项目已创建。", "success");
      } else if (dialog.kind === "folder") {
        const folder = await studioApi<ProjectFolder>("/studio/projects/folders", {
          method: "POST",
          body: jsonBody({ name: dialogValue.trim() }),
        });
        setView(`folder:${folder.id}`);
        toast("文件夹已创建。", "success");
      } else if (dialog.kind === "renameFolder" && dialog.folder) {
        await studioApi(`/studio/projects/folders/${dialog.folder.id}`, {
          method: "PATCH",
          body: jsonBody({ name: dialogValue.trim() }),
        });
        toast("文件夹名称已更新。", "success");
      } else if (dialog.project) {
        await studioApi(`/studio/projects/${dialog.project.id}`, {
          method: "PATCH",
          body: jsonBody({ folderId: dialogValue || null }),
        });
        toast("项目已移动。", "success");
      }
      setDialog(null);
      await refresh();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function renameProject(project: CanvasProject, name: string) {
    setError("");
    await studioApi(`/studio/projects/${project.id}`, { method: "PATCH", body: jsonBody({ name }) });
    await refresh();
    toast("项目名称已更新。", "success");
  }

  async function confirmDestructiveAction() {
    if (!confirmation) return;
    setConfirmBusy(true);
    setError("");
    try {
      let successMessage = "项目已彻底删除。";
      if (confirmation.kind === "deleteFolder") {
        const { folder } = confirmation;
        await studioApi(`/studio/projects/folders/${folder.id}`, { method: "DELETE" });
        if (view === `folder:${folder.id}`) setView("unfiled");
        successMessage = "文件夹已删除，项目已移至未分类。";
      } else {
        await studioApi(`/studio/projects/${confirmation.project.id}/permanent`, { method: "DELETE" });
      }
      await refresh();
      setConfirmation(null);
      toast(successMessage, "success");
    } catch (cause) {
      toast((cause as Error).message);
    } finally {
      setConfirmBusy(false);
    }
  }

  async function updateCover(file: File | undefined) {
    const targetId = coverTargetRef.current;
    if (!file || !targetId) return;
    coverTargetRef.current = null;
    if (coverInputRef.current) coverInputRef.current.value = "";
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 2_000_000) {
      toast("封面仅支持 2 MB 以内的 PNG、JPEG 或 WebP 图片。");
      return;
    }
    setError("");
    try {
      const coverUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("读取封面失败"));
        reader.readAsDataURL(file);
      });
      await studioApi(`/studio/projects/${targetId}`, { method: "PATCH", body: jsonBody({ coverUrl }) });
      await refresh();
      toast("项目封面已更新。", "success");
    } catch (cause) {
      toast((cause as Error).message);
    }
  }

  async function handleAction(action: ProjectAction, project: CanvasProject) {
    setError("");
    if (action === "open") {
      const canvas = project.canvases[0];
      if (canvas)
        window.open(canvasHref({ projectId: project.id, canvasId: canvas.id }), "_blank", "noopener,noreferrer");
      return;
    }
    if (action === "move") {
      openDialog("move", project);
      return;
    }
    if (action === "cover") {
      coverTargetRef.current = project.id;
      coverInputRef.current?.click();
      return;
    }
    if (action === "permanent") {
      setConfirmation({ kind: "deleteProjectPermanently", project });
      return;
    }
    try {
      if (action === "duplicate") {
        await studioApi(`/studio/projects/${project.id}/duplicate`, { method: "POST" });
        toast("项目副本已创建。", "success");
      } else if (action === "clearCover") {
        await studioApi(`/studio/projects/${project.id}`, { method: "PATCH", body: jsonBody({ coverUrl: null }) });
        toast("项目封面已移除。", "success");
      } else if (action === "delete") {
        await studioApi(`/studio/projects/${project.id}`, { method: "DELETE" });
        toast("项目已移入回收站。", "success");
      } else if (action === "restore") {
        await studioApi(`/studio/projects/${project.id}/restore`, { method: "POST" });
        toast("项目已恢复。", "success");
      }
      await refresh();
    } catch (cause) {
      toast((cause as Error).message);
    }
  }

  const viewTitle =
    view === "trash"
      ? "回收站"
      : view === "all"
        ? "全部项目"
        : view === "unfiled"
          ? "未分类"
          : folders.find((folder) => `folder:${folder.id}` === view)?.name || "项目";

  return (
    <AppShell>
      <div className={ui.page}>
        <header className={ui.header}>
          <div>
            <span className={ui.eyebrow}>YOUR WORKSPACE</span>
            <h1 className={ui.title}>项目</h1>
            <p className={ui.description}>在这里整理每一次创作。打开项目后，再进入画布继续工作。</p>
          </div>
          <button className={ui.button} onClick={() => openDialog("create")}>
            <Plus size={15} />
            新建项目
          </button>
        </header>
        <div className={styles.workspace}>
          <aside className={styles.sidebar} aria-label="项目分类">
            <button
              className={`${styles.sideItem} ${view === "all" ? styles.sideActive : ""}`}
              onClick={() => setView("all")}
            >
              <Layers size={16} />
              <span>全部项目</span>
              <small>{projects.length}</small>
            </button>
            <button
              className={`${styles.sideItem} ${view === "unfiled" ? styles.sideActive : ""}`}
              onClick={() => setView("unfiled")}
            >
              <Folder size={16} />
              <span>未分类</span>
            </button>
            <div className={styles.folderHeader}>
              <span>文件夹</span>
              <button type="button" onClick={() => openDialog("folder")} aria-label="新建文件夹" title="新建文件夹">
                <FolderPlus size={16} />
              </button>
            </div>
            {folders.map((folder) => (
              <div key={folder.id} className={styles.folderRow}>
                <button
                  className={`${styles.sideItem} ${view === `folder:${folder.id}` ? styles.sideActive : ""}`}
                  onClick={() => setView(`folder:${folder.id}`)}
                >
                  <Folder size={16} />
                  <Popover variant="action"
                    mode="hover"
                    openWhen={isOverflowing}
                    contentClassName={styles.namePopover}
                    trigger={<span>{folder.name}</span>}
                  >
                    {folder.name}
                  </Popover>
                  <small>{projects.filter((project) => project.folderId === folder.id).length}</small>
                </button>
                <Popover variant="action"
                  mode="click"
                  side="right"
                  align="start"
                  open={folderMenuOpen === folder.id}
                  onOpenChange={(open) => setFolderMenuOpen(open ? folder.id : null)}
                  contentClassName={styles.folderMenu}
                  trigger={
                    <button type="button" className={styles.folderMore} aria-label={`${folder.name}文件夹操作`}>
                      <MoreHorizontal size={15} />
                    </button>
                  }
                >
                  <div className={styles.menuItems}>
                    <button
                      type="button"
                      onClick={() => {
                        setFolderMenuOpen(null);
                        openDialog("renameFolder", undefined, folder);
                      }}
                    >
                      <Pencil size={15} />
                      重命名
                    </button>
                    <button
                      type="button"
                      className={styles.dangerItem}
                      onClick={() => {
                        setFolderMenuOpen(null);
                        setConfirmation({ kind: "deleteFolder", folder });
                      }}
                    >
                      <Trash2 size={15} />
                      删除文件夹
                    </button>
                  </div>
                </Popover>
              </div>
            ))}
            <div className={styles.sideDivider} />
            <button
              className={`${styles.sideItem} ${view === "trash" ? styles.sideActive : ""}`}
              onClick={() => setView("trash")}
            >
              <Trash2 size={16} />
              <span>回收站</span>
              <small>{trash.length}</small>
            </button>
          </aside>
          <section className={styles.content} aria-label={viewTitle}>
            <div className={styles.toolbar}>
              <div>
                <h2>{viewTitle}</h2>
                <p>{visible.length} 个项目</p>
              </div>
              <div className={styles.search}>
                <Search size={16} />
                <Form.Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="搜索项目"
                  aria-label="搜索项目"
                />
              </div>
            </div>
            {!dialog && error && <p className={ui.error}>{error}</p>}
            {loading ? (
              <div className={styles.empty}>正在加载项目…</div>
            ) : visible.length ? (
              <div className={styles.grid}>
                {visible.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    trash={view === "trash"}
                    onAction={(action, item) => void handleAction(action, item)}
                    onRename={renameProject}
                  />
                ))}
              </div>
            ) : (
              <div className={styles.empty}>{getEmptyMessage(query, view)}</div>
            )}
          </section>
        </div>
        <input
          ref={coverInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          hidden
          onChange={(event) => void updateCover(event.target.files?.[0])}
        />
        {dialog && (
          <Modal
            open
            title={dialogTitles[dialog.kind]}
            eyebrow="PROJECTS"
            busy={busy}
            onOpenChange={(open) => !open && setDialog(null)}
          >
            <Form
              values={{ value: dialogValue }}
              onValuesChange={(values) => setDialogValue(values.value)}
              onFinish={submitDialog}
              className={styles.dialogForm}
            >
              {dialog.kind === "move" ? (
                <Form.Select name="value" label="目标文件夹">
                  <option value="">未分类</option>
                  {folders.map((folder) => (
                    <option key={folder.id} value={folder.id}>
                      {folder.name}
                    </option>
                  ))}
                </Form.Select>
              ) : (
                <Form.Input
                  name="value"
                  label={dialog.kind === "folder" || dialog.kind === "renameFolder" ? "文件夹名称" : "项目名称"}
                  placeholder={dialog.kind === "create" ? "为项目起一个名字" : undefined}
                  maxLength={80}
                  required={dialog.kind !== "create"}
                  autoFocus
                />
              )}
              {error && <p className={ui.error}>{error}</p>}
              <Modal.Footer>
                <Modal.Button type="button" variant="quiet" onClick={() => setDialog(null)} disabled={busy}>
                  取消
                </Modal.Button>
                <Modal.Button type="submit" disabled={busy}>
                  {busy ? "处理中…" : dialog.kind === "create" ? "创建并打开" : "确认"}
                </Modal.Button>
              </Modal.Footer>
            </Form>
          </Modal>
        )}
        {confirmation && (
          <Modal
            mode="confirm"
            open
            {...getConfirmationCopy(confirmation)}
            danger
            busy={confirmBusy}
            onOpenChange={(open) => !open && setConfirmation(null)}
            onConfirm={confirmDestructiveAction}
          />
        )}
      </div>
    </AppShell>
  );
}
