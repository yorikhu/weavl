import { FolderMinus, FolderPlus } from "lucide-react";
import styles from "./index.module.scss";

interface CanvasGroupActionsProps {
  nodeIds: string[];
  groupId?: string;
  className?: string;
  onGroup?: (nodeIds: string[]) => void;
  onUngroup?: (groupId: string) => void;
}

/**
 * 画布成组操作栏。
 *
 * 框选和单组聚焦只负责定位该组件，按钮结构与样式统一在这里维护。
 *
 * @param props - 节点标识、可选分组标识和打组、解组回调。
 * @returns 与当前选择状态匹配的打组或解组按钮。
 */
export function CanvasGroupActions({ nodeIds, groupId, className, onGroup, onUngroup }: CanvasGroupActionsProps) {
  const isGrouped = Boolean(groupId);

  const runPrimaryAction = () => {
    if (groupId) {
      onUngroup?.(groupId);
      return;
    }
    onGroup?.(nodeIds);
  };

  return (
    <div
      className={`${styles.toolbar} ${className ?? ""} nodrag nopan`}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          runPrimaryAction();
        }}
      >
        {isGrouped ? <FolderMinus size={14} /> : <FolderPlus size={14} />}
        {isGrouped ? "解组" : "打组"}
      </button>
    </div>
  );
}
