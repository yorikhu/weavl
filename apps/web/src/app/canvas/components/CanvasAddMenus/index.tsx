"use client";

import {
  ClipboardPaste,
  FileText,
  Film,
  FolderInput,
  Layers,
  Link2,
  Music,
  Plus,
  Redo2,
  Sparkles,
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
  mode: "context" | "add";
}

export interface CanvasConnectMenuPosition {
  sourceNodeId: string;
  flowPos: FlowPosition;
  clientPos: { x: number; y: number };
}

interface CanvasAddMenusProps {
  addMenu: CanvasAddMenuPosition | null;
  connectMenu: CanvasConnectMenuPosition | null;
  pendingLineStart: { x: number; y: number } | null;
  onAddBasic: (kind: BasicNodeKind, position: FlowPosition) => void;
  onAddConnected: (kind: BasicNodeKind) => void;
  onShowAddMenu: () => void;
  onUpload: () => void;
  onSaveToAssets: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onPaste: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function CanvasAddMenus({
  addMenu,
  connectMenu,
  pendingLineStart,
  onAddBasic,
  onAddConnected,
  onShowAddMenu,
  onUpload,
  onSaveToAssets,
  onUndo,
  onRedo,
  onPaste,
  canUndo,
  canRedo,
}: CanvasAddMenusProps) {
  return (
    <>
      {addMenu && (
        <div className={styles.contextMenu} style={{ left: addMenu.x, top: addMenu.y }}>
          {addMenu.mode === "context" ? (
            <>
              <button className={styles.contextMenuItem} onClick={onUpload}>
                <Upload size={14} />
                上传
              </button>
              <button className={styles.contextMenuItem} onClick={onSaveToAssets}>
                <FolderInput size={14} />
                保存到我的资产
              </button>
              <button className={styles.contextMenuItem} onClick={onShowAddMenu}>
                <Plus size={14} />
                添加节点
              </button>
              <div className={styles.contextMenuSep} />
              <button className={styles.contextMenuItem} onClick={onUndo} disabled={!canUndo}>
                <Undo2 size={14} />
                撤销
              </button>
              <button className={styles.contextMenuItem} onClick={onRedo} disabled={!canRedo}>
                <Redo2 size={14} />
                重做
              </button>
              <div className={styles.contextMenuSep} />
              <button className={styles.contextMenuItem} onClick={onPaste}>
                <ClipboardPaste size={14} />
                粘贴
              </button>
            </>
          ) : (
            <>
              <div className={styles.contextMenuHead}>添加节点</div>
              {BASIC_NODE_CHOICES.map(({ kind, label, icon: Icon }) => (
                <button key={kind} className={styles.contextMenuItem} onClick={() => onAddBasic(kind, addMenu.flowPos)}>
                  <Icon size={13} />
                  {label}
                </button>
              ))}
            </>
          )}
        </div>
      )}

      {connectMenu && (
        <>
          {pendingLineStart && (
            <svg className={styles.pendingConnection} aria-hidden="true">
              <path
                className={styles.pendingConnectionPath}
                d={`M ${pendingLineStart.x} ${pendingLineStart.y} C ${pendingLineStart.x + 72} ${pendingLineStart.y}, ${connectMenu.clientPos.x - 72} ${connectMenu.clientPos.y + 20}, ${connectMenu.clientPos.x} ${connectMenu.clientPos.y + 20}`}
              />
              <circle
                className={styles.pendingConnectionDot}
                cx={connectMenu.clientPos.x}
                cy={connectMenu.clientPos.y + 20}
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
