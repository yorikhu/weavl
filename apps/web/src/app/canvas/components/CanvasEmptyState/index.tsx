"use client";

import { Plus, RefreshCw } from "lucide-react";
import styles from "./index.module.scss";

interface CanvasEmptyStateProps {
  hasRecentRun: boolean;
  onAdd: (clientX: number, clientY: number) => void;
  onLoadRecent: () => void;
}

/**
 * 渲染空画布引导，并把按钮点击位置交给节点添加菜单。
 *
 * @param props - 最近运行状态及添加、载入操作回调。
 * @returns 画布没有节点时使用的空状态。
 */
export function CanvasEmptyState({ hasRecentRun, onAdd, onLoadRecent }: CanvasEmptyStateProps) {
  return (
    <div className={styles.guide}>
      <div className={styles.guideCard}>
        <button
          type="button"
          className={styles.guideIcon}
          aria-label="添加节点"
          title="添加节点"
          onClick={(event) => onAdd(event.clientX, event.clientY)}
        >
          <Plus size={18} />
        </button>
        <div className={styles.guideCopy}>
          <div className={styles.guideTitle}>双击画布，添加第一个节点</div>
          <div className={styles.guideSub}>支持文本、图片与视频，创建后可从两侧连接点继续编排</div>
        </div>
        {hasRecentRun && (
          <button className={styles.guideLoad} onClick={onLoadRecent}>
            <RefreshCw size={14} />
            从最近任务加载
          </button>
        )}
      </div>
    </div>
  );
}
