"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowUpRight, LayoutGrid, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import type { CanvasProject } from "@weavl/shared";
import { AppShell } from "@/components/AppShell";
import { jsonBody, studioApi } from "@/lib/studioApi";
import { canvasHref, openCanvasAfter } from "@/utils/openCanvas";
import ui from "@/styles/studio.module.scss";
import styles from "./page.module.scss";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<CanvasProject[]>([]);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const refresh = useCallback(
    () =>
      studioApi<CanvasProject[]>("/studio/projects")
        .then(setProjects)
        .catch((cause) => setError((cause as Error).message)),
    [],
  );
  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function createProject() {
    setError("");
    try {
      await openCanvasAfter(async () => {
        const project = await studioApi<CanvasProject>("/studio/projects", {
          method: "POST",
          body: jsonBody({ name: name.trim() || "未命名项目" }),
        });
        return { projectId: project.id, canvasId: project.canvases[0]!.id };
      });
      await refresh();
      setCreating(false);
      setName("");
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  async function addCanvas(project: CanvasProject) {
    const title = window.prompt("新画布名称", `画布 ${project.canvases.length + 1}`);
    if (title === null) return;
    try {
      await openCanvasAfter(async () => {
        const canvas = await studioApi<{ id: string }>(`/studio/projects/${project.id}/canvases`, {
          method: "POST",
          body: jsonBody({ name: title.trim() || "新画布" }),
        });
        return { projectId: project.id, canvasId: canvas.id };
      });
      await refresh();
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  async function rename(project: CanvasProject) {
    const title = window.prompt("项目名称", project.name);
    if (!title?.trim()) return;
    try {
      await studioApi(`/studio/projects/${project.id}`, { method: "PATCH", body: jsonBody({ name: title.trim() }) });
      await refresh();
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  async function remove(project: CanvasProject) {
    if (!window.confirm(`删除「${project.name}」及其 ${project.canvases.length} 张画布？资产库中的原件仍会保留。`))
      return;
    try {
      await studioApi(`/studio/projects/${project.id}`, { method: "DELETE" });
      await refresh();
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  return (
    <AppShell>
      <div className={ui.page}>
        <header className={ui.header}>
          <div>
            <span className={ui.eyebrow}>CANVAS PROJECTS</span>
            <h1 className={ui.title}>项目</h1>
            <p className={ui.description}>一个项目可以包含多张画布。内容与布局会自动保存，资产始终保持独立引用。</p>
          </div>
          <button className={ui.button} onClick={() => setCreating((value) => !value)}>
            <Plus size={15} />
            新建项目
          </button>
        </header>
        {creating && (
          <div className={`${ui.card} ${styles.createBox}`}>
            <div>
              <h2 className={ui.cardTitle}>从一张空白画布开始</h2>
              <p className={ui.cardText}>后续可以在同一项目中继续添加画布。</p>
            </div>
            <input
              className={ui.input}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="输入项目名称"
              onKeyDown={(event) => {
                if (event.key === "Enter") void createProject();
              }}
              autoFocus
            />
            <button className={ui.button} onClick={() => void createProject()}>
              创建并打开 <ArrowUpRight size={14} />
            </button>
          </div>
        )}
        {error && <p className={ui.error}>{error}</p>}
        {projects.length === 0 ? (
          <div className={ui.empty}>还没有项目。创建一个项目，在画布里组织你的第一份内容。</div>
        ) : (
          <div className={ui.grid}>
            {projects.map((project) => (
              <article key={project.id} className={`${ui.card} ${styles.projectCard}`}>
                <div className={styles.cover}>
                  <LayoutGrid size={23} strokeWidth={1.25} />
                  <span>{project.canvases.length} 张画布</span>
                </div>
                <div className={ui.rowBetween}>
                  <div>
                    <h2 className={ui.cardTitle}>{project.name}</h2>
                    <p className={ui.cardText}>更新于 {new Date(project.updatedAt).toLocaleString("zh-CN")}</p>
                  </div>
                  <button className={styles.iconButton} title="重命名项目" onClick={() => void rename(project)}>
                    <MoreHorizontal size={18} />
                  </button>
                </div>
                <div className={styles.canvasList}>
                  {project.canvases.map((canvas) => (
                    <a
                      key={canvas.id}
                      className={styles.canvasLink}
                      href={canvasHref({ projectId: project.id, canvasId: canvas.id })}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${canvas.name}，在新标签页打开`}
                    >
                      <span>{canvas.name}</span>
                      <span>
                        {canvas.nodes.length} 节点 <ArrowUpRight size={13} />
                      </span>
                    </a>
                  ))}
                </div>
                <div className={ui.rowBetween}>
                  <button className={ui.buttonQuiet} onClick={() => void addCanvas(project)}>
                    <Plus size={13} />
                    添加画布
                  </button>
                  <button className={ui.buttonDanger} title="删除项目" onClick={() => void remove(project)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
