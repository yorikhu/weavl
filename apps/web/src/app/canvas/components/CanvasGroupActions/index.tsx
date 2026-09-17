import { FolderMinus, FolderPlus } from "lucide-react";
import { CanvasActionToolbar } from "../CanvasActionToolbar";

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
    <CanvasActionToolbar
      className={className}
      ariaLabel={isGrouped ? "解组操作" : "打组操作"}
      actions={[
        {
          key: isGrouped ? "ungroup" : "group",
          icon: isGrouped ? <FolderMinus /> : <FolderPlus />,
          title: isGrouped ? "解组" : "打组",
          label: isGrouped ? "解组" : "打组",
          onClick: runPrimaryAction,
        },
      ]}
    />
  );
}
