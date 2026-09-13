"use client";

import { Plus, RefreshCw } from "lucide-react";
import styles from "../page.module.scss";

interface CanvasEmptyStateProps {
  hasRecentRun: boolean;
  onAdd: (clientX: number, clientY: number) => void;
  onLoadRecent: () => void;
}

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
