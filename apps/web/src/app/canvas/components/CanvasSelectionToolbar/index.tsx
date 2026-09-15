import { NodeToolbar, Position } from "@xyflow/react";
import { CanvasGroupActions } from "../CanvasGroupActions";
import styles from "./index.module.scss";

interface CanvasSelectionToolbarProps {
  nodeIds: string[];
  topInset: number;
  groupId?: string;
  onGroup: (nodeIds: string[]) => void;
  onUngroup: (groupId: string) => void;
}

/** 多节点框选操作栏；紧贴选区上沿，并提供选中节点的批量操作。 */
export function CanvasSelectionToolbar({
  nodeIds,
  topInset,
  groupId,
  onGroup,
  onUngroup,
}: CanvasSelectionToolbarProps) {
  if (nodeIds.length < 2) return null;

  return (
    <NodeToolbar nodeId={nodeIds} isVisible position={Position.Top} offset={topInset + 4} className={styles.anchor}>
      <CanvasGroupActions nodeIds={nodeIds} groupId={groupId} onGroup={onGroup} onUngroup={onUngroup} />
    </NodeToolbar>
  );
}
