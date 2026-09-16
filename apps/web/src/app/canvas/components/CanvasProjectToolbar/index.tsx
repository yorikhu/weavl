"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, Home, Layers, MoreHorizontal, Pencil, Plus, Search, Trash2 } from "lucide-react";
import type { CanvasDocument } from "@weavl/shared";
import { Form } from "@/components/Form";
import { Modal } from "@/components/Modal";
import { Popover } from "@/components/Popover";
import { WeavlBrand } from "@/components/WeavlBrand";
import styles from "./index.module.scss";

export interface CanvasProjectToolbarProps {
  variant?: "canvas" | "drawer";
  projectName: string;
  onProjectNameChange: (name: string) => void;
  projectMenuOpen: boolean;
  onProjectMenuOpenChange: (open: boolean) => void;
  onHome: () => void;
  onProjects: () => void;
  onCreateProject: () => void;
  onDeleteProject: () => void;
  canvases: CanvasDocument[];
  currentCanvasId: string | null;
  onSelectCanvas: (canvas: CanvasDocument) => void;
  onCreateCanvas: (name?: string) => void;
  onRenameCanvas: (canvas: CanvasDocument, name: string) => Promise<void>;
  onDeleteCanvas: (canvas: CanvasDocument) => Promise<void>;
}

interface CanvasSwitcherProps {
  canvases: CanvasDocument[];
  currentCanvasId: string | null;
  onSelect: (canvas: CanvasDocument) => void;
  onCreate: (name?: string) => void;
  onRename: (canvas: CanvasDocument, name: string) => Promise<void>;
  onDelete: (canvas: CanvasDocument) => Promise<void>;
}

type CanvasDialog = { kind: "rename" | "delete"; canvas: CanvasDocument };

const isOverflowing = (element: HTMLElement) => element.scrollWidth > element.clientWidth;
const isBlurredAndOverflowing = (element: HTMLElement) => document.activeElement !== element && isOverflowing(element);

/**
 * 渲染项目内的画布搜索、新建、切换和管理入口。
 *
 * @param props - 画布集合、当前画布标识和增删改切换回调。
 * @returns 画布选择 Popover 及其重命名、删除弹窗。
 */
function CanvasSwitcher({ canvases, currentCanvasId, onSelect, onCreate, onRename, onDelete }: CanvasSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState<CanvasDialog | null>(null);
  const [renameForm, setRenameForm] = useState({ name: "" });
  const [busy, setBusy] = useState(false);
  const currentCanvas = canvases.find((canvas) => canvas.id === currentCanvasId);
  const filteredCanvases = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase();
    return keyword ? canvases.filter((canvas) => canvas.name.toLocaleLowerCase().includes(keyword)) : canvases;
  }, [canvases, query]);

  const createCanvas = () => {
    onCreate(query.trim() || undefined);
    setQuery("");
    setOpen(false);
  };

  const beginAction = (kind: CanvasDialog["kind"], canvas: CanvasDocument) => {
    setOpen(false);
    setDialog({ kind, canvas });
    if (kind === "rename") setRenameForm({ name: canvas.name });
  };

  const submitRename = async () => {
    if (!dialog || dialog.kind !== "rename") return;
    const name = renameForm.name.trim();
    if (!name || name === dialog.canvas.name) {
      setDialog(null);
      return;
    }
    setBusy(true);
    try {
      await onRename(dialog.canvas, name);
      setDialog(null);
    } catch {
      // 页面层负责展示接口错误，保留弹窗便于用户继续修改。
    } finally {
      setBusy(false);
    }
  };

  const submitDelete = async () => {
    if (!dialog || dialog.kind !== "delete") return;
    setBusy(true);
    try {
      await onDelete(dialog.canvas);
      setDialog(null);
    } catch {
      // 页面层负责展示接口错误，保留确认弹窗。
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Popover
        mode="click"
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) setQuery("");
        }}
        side="bottom"
        align="start"
        sideOffset={8}
        showArrow={false}
        ariaLabel="选择画布"
        contentClassName={`${styles.canvasPopover} glass-strong`}
        preserveOpenOnOutsideSelector={`.${styles.canvasActionsPopover}`}
        trigger={
          <button type="button" className={styles.canvasTrigger} aria-expanded={open}>
            <Popover
              mode="hover"
              side="top"
              sideOffset={7}
              showArrow={false}
              openWhen={isOverflowing}
              contentClassName={styles.overflowTitlePopover}
              trigger={<span className={styles.currentCanvasName}>{currentCanvas?.name || "画布"}</span>}
            >
              {currentCanvas?.name || "画布"}
            </Popover>
            <ChevronDown size={15} strokeWidth={2.2} className={open ? styles.chevronOpen : styles.chevron} />
          </button>
        }
      >
        <div className={styles.canvasSearch}>
          <Search size={13} />
          <Form.Input
            variant="bare"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") createCanvas();
            }}
            placeholder="搜索或输入新画布名称"
            aria-label="搜索画布"
            autoFocus
          />
        </div>
        <div className={styles.canvasList} onWheel={(event) => event.stopPropagation()}>
          {filteredCanvases.map((canvas) => (
            <div
              key={canvas.id}
              className={`${styles.canvasItemRow} ${canvas.id === currentCanvasId ? styles.canvasItemActive : ""}`}
            >
              <button
                type="button"
                className={styles.canvasItem}
                onClick={() => {
                  onSelect(canvas);
                  setOpen(false);
                }}
              >
                <Popover
                  mode="hover"
                  side="top"
                  sideOffset={7}
                  showArrow={false}
                  openWhen={isOverflowing}
                  contentClassName={styles.overflowTitlePopover}
                  trigger={<span>{canvas.name}</span>}
                >
                  {canvas.name}
                </Popover>
                {canvas.id === currentCanvasId && <Check size={13} />}
              </button>
              <Popover
                variant="action"
                side="right"
                align="start"
                sideOffset={5}
                showArrow={false}
                contentClassName={styles.canvasActionsPopover}
                ariaLabel={`${canvas.name}操作`}
                trigger={
                  <button type="button" className={styles.canvasMore} aria-label={`${canvas.name}更多操作`}>
                    <MoreHorizontal size={14} />
                  </button>
                }
              >
                <button type="button" className={styles.canvasAction} onClick={() => beginAction("rename", canvas)}>
                  <Pencil size={13} />
                  重命名
                </button>
                <button
                  type="button"
                  className={`${styles.canvasAction} ${styles.canvasActionDanger}`}
                  disabled={canvases.length === 1}
                  onClick={() => beginAction("delete", canvas)}
                >
                  <Trash2 size={13} />
                  {canvases.length === 1 ? "至少保留一张画布" : "删除"}
                </button>
              </Popover>
            </div>
          ))}
          {!filteredCanvases.length && <div className={styles.canvasEmpty}>没有匹配的画布</div>}
        </div>
        <div className={styles.canvasSeparator} />
        <button type="button" className={styles.createCanvas} onClick={createCanvas}>
          <Plus size={14} />
          <span>{query.trim() ? `新建“${query.trim()}”` : "新建画布"}</span>
        </button>
      </Popover>
      <Modal
        open={dialog?.kind === "rename"}
        title="重命名画布"
        description="画布内容和项目内的引用不会受到影响。"
        busy={busy}
        onOpenChange={(nextOpen) => !nextOpen && setDialog(null)}
      >
        <Form className={styles.renameForm} values={renameForm} onValuesChange={setRenameForm} onFinish={submitRename}>
          <Form.Input name="name" label="画布名称" maxLength={80} required autoFocus />
          <Modal.Footer>
            <Modal.Button type="button" variant="quiet" disabled={busy} onClick={() => setDialog(null)}>
              取消
            </Modal.Button>
            <Modal.Button type="submit" disabled={busy || !renameForm.name.trim()}>
              {busy ? "保存中…" : "保存"}
            </Modal.Button>
          </Modal.Footer>
        </Form>
      </Modal>
      <Modal
        mode="confirm"
        open={dialog?.kind === "delete"}
        title="删除画布"
        description={`确定删除“${dialog?.canvas.name || "这张画布"}”吗？画布中的节点和连线将无法恢复。`}
        confirmLabel="删除"
        danger
        busy={busy}
        onOpenChange={(nextOpen) => !nextOpen && setDialog(null)}
        onConfirm={submitDelete}
      />
    </>
  );
}

/**
 * 渲染画布项目操作栏。
 * `canvas` 变体用于左上角完整形态，`drawer` 变体用于资产抽屉顶部紧凑形态。
 *
 * @param props - 项目名称、项目菜单、画布列表及对应操作回调。
 * @returns 与使用场景匹配的项目操作栏。
 */
export function CanvasProjectToolbar({
  variant = "canvas",
  projectName,
  onProjectNameChange,
  projectMenuOpen,
  onProjectMenuOpenChange,
  onHome,
  onProjects,
  onCreateProject,
  onDeleteProject,
  canvases,
  currentCanvasId,
  onSelectCanvas,
  onCreateCanvas,
  onRenameCanvas,
  onDeleteCanvas,
}: CanvasProjectToolbarProps) {
  return (
    <div className={`${styles.toolbar} ${variant === "drawer" ? styles.drawer : styles.canvas}`}>
      <Popover
        mode="click"
        open={projectMenuOpen}
        onOpenChange={onProjectMenuOpenChange}
        side="bottom"
        align="start"
        sideOffset={8}
        showArrow={false}
        ariaLabel="项目操作"
        contentRole="menu"
        contentClassName={`${styles.projectPopover} glass-strong`}
        trigger={
          <button
            type="button"
            className={`${styles.menuTrigger} ${projectMenuOpen ? styles.menuTriggerOpen : ""}`}
            aria-label="打开项目菜单"
            aria-expanded={projectMenuOpen}
          >
            <WeavlBrand variant="icon" iconSize={19} />
            <ChevronDown size={13} className={projectMenuOpen ? styles.chevronOpen : styles.chevron} />
          </button>
        }
      >
        <button type="button" role="menuitem" className={styles.menuItem} onClick={onHome}>
          <Home size={14} />
          回到主页
        </button>
        <button type="button" role="menuitem" className={styles.menuItem} onClick={onProjects}>
          <Layers size={14} />
          全部项目
        </button>
        <button type="button" role="menuitem" className={styles.menuItem} onClick={onCreateProject}>
          <Plus size={14} />
          创建项目
        </button>
        <div className={styles.separator} role="separator" />
        <button
          type="button"
          role="menuitem"
          className={`${styles.menuItem} ${styles.danger}`}
          onClick={onDeleteProject}
        >
          <Trash2 size={14} />
          删除项目
        </button>
      </Popover>
      <Popover
        mode="hover"
        side="top"
        sideOffset={7}
        showArrow={false}
        openWhen={isBlurredAndOverflowing}
        contentClassName={styles.overflowTitlePopover}
        trigger={
          <input
            className={styles.nameInput}
            value={projectName}
            onChange={(event) => onProjectNameChange(event.target.value)}
            onBlur={() => onProjectNameChange(projectName.trim() || "未命名项目")}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
            aria-label="项目名称"
            spellCheck={false}
          />
        }
      >
        {projectName}
      </Popover>
      <div className={styles.toolbarSeparator} />
      <CanvasSwitcher
        canvases={canvases}
        currentCanvasId={currentCanvasId}
        onSelect={onSelectCanvas}
        onCreate={onCreateCanvas}
        onRename={onRenameCanvas}
        onDelete={onDeleteCanvas}
      />
    </div>
  );
}
