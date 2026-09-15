import { NodeToolbar, Position, useViewport } from "@xyflow/react";
import { CanvasGroupActions } from "../CanvasGroupActions";
import styles from "./index.module.scss";

interface CanvasSelectionToolbarProps {
  nodeIds: string[];
  topInset: number;
  groupId?: string;
  onGroup: (nodeIds: string[]) => void;
  onUngroup: (groupId: string) => void;
}

const TOOLBAR_FRAME_GAP = 12;

/**
 * 渲染紧贴选区上沿的多节点操作栏。
 *
 * @param props - 选中节点、定位内边距、完整分组标识和分组操作回调。
 * @returns 通过 PanelPortal 挂载的选择操作栏；没有节点时返回 `null`。
 */
export function CanvasSelectionToolbar({
  nodeIds,
  topInset,
  groupId,
  onGroup,
  onUngroup,
}: CanvasSelectionToolbarProps) {
  const { zoom } = useViewport();
  if (nodeIds.length < 2) return null;

  /* NodeToolbar 的 offset 是屏幕像素，外框 inset 是画布单位，需要按当前缩放换算。 */
  const toolbarOffset = topInset * zoom + TOOLBAR_FRAME_GAP;

  return (
    <NodeToolbar nodeId={nodeIds} isVisible position={Position.Top} offset={toolbarOffset} className={styles.anchor}>
      <CanvasGroupActions nodeIds={nodeIds} groupId={groupId} onGroup={onGroup} onUngroup={onUngroup} />
    </NodeToolbar>
  );
}
