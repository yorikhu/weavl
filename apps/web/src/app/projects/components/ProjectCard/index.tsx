"use client";

import Image from "next/image";
import { useId, useRef, useState } from "react";
import { ArrowUpRight, Copy, FolderInput, ImagePlus, MoreHorizontal, Pencil, RotateCcw, Trash2, X } from "lucide-react";
import type { CanvasProject } from "@weavl/shared";
import { Popover } from "@/components/Popover";
import { Form } from "@/components/Form";
import { canvasHref } from "@/utils/openCanvas";
import { createTiltCardHandlers } from "@/utils/tiltCard";
import styles from "../../page.module.scss";

export type ProjectAction =
  "open" | "rename" | "cover" | "clearCover" | "duplicate" | "move" | "delete" | "restore" | "permanent";
const tiltHandlers = createTiltCardHandlers<HTMLElement>();
const isOverflowing = (element: HTMLElement) => element.scrollWidth > element.clientWidth;

function DefaultCover() {
  const id = useId();
  const backgroundId = `${id}-background`;
  const sheetId = `${id}-sheet`;
  return (
    <svg className={styles.coverArtwork} viewBox="0 0 640 400" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={backgroundId} x1="30" y1="18" x2="620" y2="400" gradientUnits="userSpaceOnUse">
          <stop stopColor="#303638" />
          <stop offset=".55" stopColor="#222729" />
          <stop offset="1" stopColor="#171B1D" />
        </linearGradient>
        <linearGradient id={sheetId} x1="180" y1="80" x2="520" y2="350" gradientUnits="userSpaceOnUse">
          <stop stopColor="#D8D5C8" />
          <stop offset="1" stopColor="#8C928D" />
        </linearGradient>
      </defs>
      <rect width="640" height="400" fill={`url(#${backgroundId})`} />
      <path
        d="M0 306C113 266 185 302 293 255C397 210 499 193 640 220"
        stroke="#F4F3E8"
        strokeOpacity=".09"
        strokeWidth="1.5"
      />
      <rect
        x="165"
        y="94"
        width="300"
        height="213"
        rx="12"
        transform="rotate(-12 165 94)"
        fill="#141819"
        stroke="#A9AFAB"
        strokeOpacity=".45"
      />
      <rect x="201" y="85" width="300" height="213" rx="12" transform="rotate(6 201 85)" fill={`url(#${sheetId})`} />
      <path
        d="M240 160H442M240 179H397M240 232H467"
        stroke="#303A38"
        strokeOpacity=".4"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M0 371C155 326 293 361 425 313C510 282 570 283 640 267"
        stroke="#EDEBE0"
        strokeOpacity=".13"
        strokeWidth="2"
      />
    </svg>
  );
}

/**
 * 渲染项目列表中的单个项目。
 *
 * @param props - 组件属性。
 * @returns 支持重命名和操作菜单的项目卡片。
 */
export function ProjectCard({
  project,
  trash,
  onAction,
  onRename,
}: {
  project: CanvasProject;
  trash: boolean;
  onAction: (action: ProjectAction, project: CanvasProject) => void;
  onRename: (project: CanvasProject, name: string) => Promise<void>;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(project.name);
  const [renameError, setRenameError] = useState("");
  const [saving, setSaving] = useState(false);
  const cardRef = useRef<HTMLElement>(null);
  const cancelRenameRef = useRef(false);
  const firstCanvas = project.canvases[0];
  const href = firstCanvas ? canvasHref({ projectId: project.id, canvasId: firstCanvas.id }) : undefined;
  const startRename = () => {
    if (trash) return;
    cardRef.current?.style.setProperty("--tilt-x", "0deg");
    cardRef.current?.style.setProperty("--tilt-y", "0deg");
    setDraft(project.name);
    setRenameError("");
    cancelRenameRef.current = false;
    setEditing(true);
  };
  const saveRename = async () => {
    if (cancelRenameRef.current || saving) return;
    const name = draft.trim();
    if (!name) {
      setRenameError("请输入项目名称");
      return;
    }
    if (name === project.name) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onRename(project, name);
      setEditing(false);
      setRenameError("");
    } catch (cause) {
      setRenameError((cause as Error).message);
    } finally {
      setSaving(false);
    }
  };
  const run = (action: ProjectAction) => {
    setMenuOpen(false);
    if (action === "rename") {
      startRename();
      return;
    }
    onAction(action, project);
  };
  const artwork = project.coverUrl ? (
    <Image
      src={project.coverUrl}
      alt=""
      fill
      sizes="(max-width: 700px) 100vw, 360px"
      unoptimized
      className={styles.coverImage}
    />
  ) : (
    <DefaultCover />
  );

  return (
    <article
      ref={cardRef}
      className={`${styles.projectCard} ${href && !trash ? styles.openable : ""} ${editing ? styles.editing : ""}`}
      onPointerMove={href && !trash && !editing ? tiltHandlers.onPointerMove : undefined}
      onPointerLeave={tiltHandlers.onPointerLeave}
    >
      {href && !trash && (
        <a
          className={styles.cardHitArea}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`打开项目${project.name}`}
        />
      )}
      <div className={styles.cover}>{artwork}</div>
      <div className={styles.cardFooter}>
        <div className={styles.cardInfo}>
          <h2 className={editing ? styles.nameEditing : undefined}>
            {editing ? (
              <Form.Input
                className={styles.nameInput}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onBlur={() => void saveRename()}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    event.currentTarget.blur();
                  } else if (event.key === "Escape") {
                    cancelRenameRef.current = true;
                    setEditing(false);
                  }
                }}
                aria-label="项目名称"
                maxLength={80}
                autoFocus
                disabled={saving}
              />
            ) : (
              <Popover
                variant="action"
                mode="hover"
                side="top"
                openWhen={isOverflowing}
                contentClassName={styles.namePopover}
                trigger={
                  <span className={styles.projectName} onDoubleClick={startRename}>
                    {project.name}
                  </span>
                }
              >
                {project.name}
              </Popover>
            )}
          </h2>
          {renameError && <span className={styles.renameError}>{renameError}</span>}
          <p>
            {trash ? "删除于" : "最近修改"}{" "}
            {new Date(trash ? project.deletedAt || project.updatedAt : project.updatedAt).toLocaleString("zh-CN")}
          </p>
        </div>
        <Popover
          variant="action"
          mode="click"
          side="bottom"
          align="end"
          open={menuOpen}
          onOpenChange={setMenuOpen}
          ariaLabel={`${project.name}操作`}
          contentClassName={styles.projectMenu}
          trigger={
            <button type="button" className={styles.menuTrigger} aria-label={`${project.name}更多操作`}>
              <MoreHorizontal size={18} />
            </button>
          }
        >
          <div className={styles.menuItems}>
            {trash ? (
              <>
                <button type="button" onClick={() => run("restore")}>
                  <RotateCcw size={15} />
                  恢复项目
                </button>
                <button type="button" className={styles.dangerItem} onClick={() => run("permanent")}>
                  <Trash2 size={15} />
                  彻底删除
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => run("open")}>
                  <ArrowUpRight size={15} />
                  打开
                </button>
                <button type="button" onClick={() => run("rename")}>
                  <Pencil size={15} />
                  重命名
                </button>
                <button type="button" onClick={() => run("cover")}>
                  <ImagePlus size={15} />
                  修改封面
                </button>
                {project.coverUrl && (
                  <button type="button" onClick={() => run("clearCover")}>
                    <X size={15} />
                    移除封面
                  </button>
                )}
                <button type="button" onClick={() => run("duplicate")}>
                  <Copy size={15} />
                  创建副本
                </button>
                <button type="button" onClick={() => run("move")}>
                  <FolderInput size={15} />
                  移动至文件夹
                </button>
                <span className={styles.menuDivider} />
                <button type="button" className={styles.dangerItem} onClick={() => run("delete")}>
                  <Trash2 size={15} />
                  删除项目
                </button>
              </>
            )}
          </div>
        </Popover>
      </div>
    </article>
  );
}
