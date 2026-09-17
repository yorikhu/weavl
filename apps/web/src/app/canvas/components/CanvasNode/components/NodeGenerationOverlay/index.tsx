import type { NodeGenerationStatus } from "../../../../types/nodes";
import { getGenerationErrorMessage } from "../../../../utils/nodeGenerationState";
import styles from "./index.module.scss";

interface NodeGenerationOverlayProps {
  status?: NodeGenerationStatus;
  label: string;
  error?: string;
}

/**
 * 在节点卡片内部显示生成进度，避免状态只存在于提示词面板的发送按钮上。
 *
 * @param props - 当前生成状态与媒体类型文案。
 * @returns 运行中状态的磨砂蒙层；任务结束时不渲染。
 */
export function NodeGenerationOverlay({ status, label, error }: NodeGenerationOverlayProps) {
  if (status === "failed") {
    const message = getGenerationErrorMessage(error, `暂时无法生成${label}，请重试`);
    return (
      <div className={`${styles.overlay} ${styles.failed}`} role="alert">
        <strong>生成失败</strong>
        <span>{message}</span>
      </div>
    );
  }
  if (!status || !["queued", "running", "finalizing"].includes(status)) return null;
  const text = status === "finalizing" ? "正在整理结果" : `正在生成${label}`;

  return (
    <div className={styles.overlay} role="status" aria-live="polite">
      <span className={styles.spinner} aria-hidden="true" />
      <span>{text}</span>
    </div>
  );
}
