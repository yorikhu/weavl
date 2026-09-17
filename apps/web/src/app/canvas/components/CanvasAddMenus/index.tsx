"use client";

import { createPortal } from "react-dom";
import {
  ClipboardPaste,
  Copy,
  CopyPlus,
  FileText,
  Film,
  FolderInput,
  Layers,
  Link2,
  Music,
  Plus,
  Redo2,
  Sparkles,
  Trash2,
  Undo2,
  Upload,
} from "lucide-react";
import { BASIC_NODE_CHOICES } from "../../constants";
import type { BasicNodeKind } from "../../types/nodes";
import type { FlowPosition } from "../../utils/nodeFactory";
import styles from "./index.module.scss";

export interface CanvasAddMenuPosition {
  x: number;
  y: number;
  flowPos: FlowPosition;
  clientPos: { x: number; y: number };
  mode: "context" | "add" | "node";
  nodeIds?: string[];
}

export interface CanvasConnectMenuPosition {
  sourceNodeId: string;
  sourceNodeIds?: string[];
  flowPos: FlowPosition;
  dropPos: { x: number; y: number };
  clientPos: { x: number; y: number };
}

interface CanvasAddMenusProps {
  addMenu: CanvasAddMenuPosition | null;
  connectMenu: CanvasConnectMenuPosition | null;
  pendingLineStarts: Array<{ id: string; x: number; y: number }>;
  onAddBasic: (kind: BasicNodeKind, position: FlowPosition) => void;
  onAddConnected: (kind: BasicNodeKind) => void;
  onShowAddMenu: () => void;
  onUpload: () => void;
  onSaveToAssets: () => void;
  onSaveNodeToAssets: (nodeIds: string[]) => void;
  onCopyNode: (nodeIds: string[]) => void;
  onDuplicateNode: (nodeIds: string[]) => void;
  onDeleteNode: (nodeIds: string[]) => void;
  onUndo: () => void;
  onRedo: () => void;
  onPaste: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

interface CanvasMenuContentProps {
  menu: CanvasAddMenuPosition;
  onAddBasic: CanvasAddMenusProps["onAddBasic"];
  onShowAddMenu: () => void;
  onUpload: () => void;
  onSaveToAssets: () => void;
  onSaveNodeToAssets: (nodeIds: string[]) => void;
  onCopyNode: (nodeIds: string[]) => void;
  onDuplicateNode: (nodeIds: string[]) => void;
  onDeleteNode: (nodeIds: string[]) => void;
  onUndo: () => void;
  onRedo: () => void;
  onPaste: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

/**
 * 渲染画布或节点右键菜单的共享操作项。
 *
 * @param props - 菜单模式、撤销状态和节点操作回调。
 * @returns 与当前命中对象匹配的菜单内容。
 */
function CanvasMenuContent(props: CanvasMenuContentProps) {
  const { menu } = props;
  if (menu.mode === "add") {
    return (
      <>
        <div className={styles.contextMenuHead}>添加节点</div>
        {BASIC_NODE_CHOICES.map(({ kind, label, icon: Icon }) => (
          <button key={kind} className={styles.contextMenuItem} onClick={() => props.onAddBasic(kind, menu.flowPos)}>
            <Icon size={13} />
            {label}
          </button>
        ))}
      </>
    );
  }

  if (menu.mode === "node" && menu.nodeIds?.length) {
    const nodeIds = menu.nodeIds;
    return (
      <>
        <button className={styles.contextMenuItem} onClick={() => props.onSaveNodeToAssets(nodeIds)}>
          <FolderInput size={14} />
          保存到我的资产
        </button>
        <button className={styles.contextMenuItem} onClick={() => props.onCopyNode(nodeIds)}>
          <Copy size={14} />
          复制节点
        </button>
        <button className={styles.contextMenuItem} onClick={() => props.onDuplicateNode(nodeIds)}>
          <CopyPlus size={14} />
          创建副本
        </button>
        <button className={styles.contextMenuItem} onClick={props.onPaste}>
          <ClipboardPaste size={14} />
          粘贴
        </button>
        <div className={styles.contextMenuSep} />
        <button
          className={`${styles.contextMenuItem} ${styles.dangerItem}`}
          onClick={() => props.onDeleteNode(nodeIds)}
        >
          <Trash2 size={14} />
          删除
        </button>
      </>
    );
  }

  return (
    <>
      <button className={styles.contextMenuItem} onClick={props.onUpload}>
        <Upload size={14} />
        上传
      </button>
      <button className={styles.contextMenuItem} onClick={props.onSaveToAssets}>
        <FolderInput size={14} />
        保存到我的资产
      </button>
      <button className={styles.contextMenuItem} onClick={props.onShowAddMenu}>
        <Plus size={14} />
        添加节点
      </button>
      <div className={styles.contextMenuSep} />
      <button className={styles.contextMenuItem} onClick={props.onUndo} disabled={!props.canUndo}>
        <Undo2 size={14} />
        撤销
      </button>
      <button className={styles.contextMenuItem} onClick={props.onRedo} disabled={!props.canRedo}>
        <Redo2 size={14} />
        重做
      </button>
      <div className={styles.contextMenuSep} />
      <button className={styles.contextMenuItem} onClick={props.onPaste}>
        <ClipboardPaste size={14} />
        粘贴
      </button>
    </>
  );
}

/**
 * 渲染画布右键菜单、双击添加菜单以及拖线后的节点创建菜单。
 *
 * @param props - 菜单坐标、当前连线状态和各项画布操作回调。
 * @returns 当前存在菜单状态时返回对应浮层，否则返回 `null`。
 */
export function CanvasAddMenus({
  addMenu,
  connectMenu,
  pendingLineStarts,
  onAddBasic,
  onAddConnected,
  onShowAddMenu,
  onUpload,
  onSaveToAssets,
  onSaveNodeToAssets,
  onCopyNode,
  onDuplicateNode,
  onDeleteNode,
  onUndo,
  onRedo,
  onPaste,
  canUndo,
  canRedo,
}: CanvasAddMenusProps) {
  return (
    <>
      {addMenu &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className={`${styles.contextMenu} ${styles.portalMenu}`}
            style={{ left: addMenu.clientPos.x, top: addMenu.clientPos.y }}
          >
            <CanvasMenuContent
              menu={addMenu}
              onAddBasic={onAddBasic}
              onShowAddMenu={onShowAddMenu}
              onUpload={onUpload}
              onSaveToAssets={onSaveToAssets}
              onSaveNodeToAssets={onSaveNodeToAssets}
              onCopyNode={onCopyNode}
              onDuplicateNode={onDuplicateNode}
              onDeleteNode={onDeleteNode}
              onUndo={onUndo}
              onRedo={onRedo}
              onPaste={onPaste}
              canUndo={canUndo}
              canRedo={canRedo}
            />
          </div>,
          document.body,
        )}

      {connectMenu && (
        <>
          {pendingLineStarts.length > 0 && (
            <svg className={styles.pendingConnection} aria-hidden="true">
              {pendingLineStarts.map((start) => (
                <path
                  key={start.id}
                  className={styles.pendingConnectionPath}
                  d={`M ${start.x} ${start.y} C ${start.x + 72} ${start.y}, ${connectMenu.dropPos.x - 72} ${connectMenu.dropPos.y}, ${connectMenu.dropPos.x} ${connectMenu.dropPos.y}`}
                />
              ))}
              <circle
                className={styles.pendingConnectionDot}
                cx={connectMenu.dropPos.x}
                cy={connectMenu.dropPos.y}
                r="3"
              />
            </svg>
          )}
          <div
            className={styles.contextMenu}
            style={{ left: connectMenu.clientPos.x, top: connectMenu.clientPos.y, minWidth: 220 }}
          >
            <div className={styles.contextMenuHead}>引用该节点生成</div>
            {BASIC_NODE_CHOICES.map(({ kind, label, icon: Icon }) => (
              <button key={kind} className={styles.contextMenuItem} onClick={() => onAddConnected(kind)}>
                <Icon size={13} />
                {label}
              </button>
            ))}
            <div className={styles.contextMenuSep} />
            {/* TODO(canvas-nodes): 接入下列媒体业务节点后移除 disabled 状态。 */}
            <button className={styles.contextMenuItem} disabled title="即将上线">
              <Sparkles size={13} />
              智能剪辑
              <span className={styles.contextMenuBadge}>Beta</span>
            </button>
            <button className={styles.contextMenuItem} disabled title="即将上线">
              <Film size={13} />
              导演台
              <span className={`${styles.contextMenuBadge} ${styles.contextMenuBadgeNew}`}>NEW</span>
            </button>
            <button className={styles.contextMenuItem} disabled title="即将上线">
              <Layers size={13} />
              逐帧拉片
              <span className={styles.contextMenuBadge}>SD 2.5</span>
            </button>
            <div className={styles.contextMenuSep} />
            <button className={styles.contextMenuItem} disabled title="即将上线">
              <Music size={13} />
              音频
            </button>
            <button className={styles.contextMenuItem} disabled title="即将上线">
              <FileText size={13} />
              脚本
            </button>
            <button className={styles.contextMenuItem} disabled title="即将上线">
              <Link2 size={13} />
              参考节点
            </button>
          </div>
        </>
      )}
    </>
  );
}
