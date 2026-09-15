const CARD_HANDLE_VISUAL_OFFSET = 15;

export interface HandleScreenDistance {
  safeScale: number;
  screenDx: number;
  screenDy: number;
  distanceSq: number;
}

/** 判断连接点是否属于有效卡片；多选与整组屏蔽由调用侧结合完整选择状态处理。 */
export function isCardHandleInteractive(handle: HTMLElement): boolean {
  return Boolean(handle.closest<HTMLElement>(".react-flow__node"));
}

/** 指针从节点或组的可拖动表面按下时，磁吸系统应暂停到本次手势结束。 */
export function isCanvasMovePointerTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (!target.closest(".react-flow__node, [data-canvas-group]")) return false;
  return !target.closest(
    ".react-flow__handle, [data-batch-connect-handle], button, input, textarea, [contenteditable='true'], .nodrag",
  );
}

/**
 * 判断连接点所在的卡片边缘是否位于最上层。
 * 更高层的组框盖住该边缘时，不允许隐藏在下方的连接点抢占磁吸。
 * 层级由 React Flow 和组图层直接写在 style 上，无需 getComputedStyle 强制刷新布局。
 */
export function isCardHandleExposed(handle: HTMLElement): boolean {
  const node = handle.closest<HTMLElement>(".react-flow__node");
  const surface = node?.querySelector<HTMLElement>("[data-canvas-node-surface]");
  if (!node || !surface) return false;
  const surfaceRect = surface.getBoundingClientRect();
  const handleRect = handle.getBoundingClientRect();
  const isLeft = handle.classList.contains("react-flow__handle-left");
  const point = {
    x: isLeft ? surfaceRect.left + 2 : surfaceRect.right - 2,
    y: Math.max(surfaceRect.top + 2, Math.min(handleRect.top + handleRect.height / 2, surfaceRect.bottom - 2)),
  };
  const nodeLayer = Number.parseInt(node.style.zIndex, 10) || 0;
  const possibleCovers = document.querySelectorAll<HTMLElement>("[data-canvas-group]");
  for (const layer of possibleCovers) {
    const layerIndex = Number.parseInt(layer.style.zIndex, 10) || 0;
    if (layerIndex <= nodeLayer) continue;
    const rect = layer.getBoundingClientRect();
    if (point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom) return false;
  }
  return true;
}

function getHandleGeometry(handle: HTMLElement) {
  const rect = handle.getBoundingClientRect();
  const scale = handle.offsetWidth > 0 ? rect.width / handle.offsetWidth : 1;
  const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
  return { rect, safeScale };
}

/** 计算卡片连接圆点与指针的屏幕距离；卡片内部不属于吸附区域。 */
export function getCardHandleDistance(
  handle: HTMLElement,
  pointerX: number,
  pointerY: number,
): HandleScreenDistance | null {
  const { rect, safeScale } = getHandleGeometry(handle);
  const isLeft = handle.classList.contains("react-flow__handle-left");
  const surface = handle.closest(".react-flow__node")?.querySelector<HTMLElement>("[data-canvas-node-surface]");
  const surfaceRect = surface?.getBoundingClientRect();
  if (surfaceRect && (isLeft ? pointerX >= surfaceRect.left : pointerX <= surfaceRect.right)) return null;

  const visualOffsetX = (isLeft ? -CARD_HANDLE_VISUAL_OFFSET : CARD_HANDLE_VISUAL_OFFSET) * safeScale;
  const screenDx = pointerX - (rect.left + rect.width / 2 + visualOffsetX);
  const screenDy = pointerY - (rect.top + rect.height / 2);
  return { safeScale, screenDx, screenDy, distanceSq: screenDx * screenDx + screenDy * screenDy };
}

/** 计算视觉圆点位于元素中心时与指针的屏幕距离。 */
export function getCenteredHandleDistance(
  handle: HTMLElement,
  pointerX: number,
  pointerY: number,
): HandleScreenDistance {
  const { rect, safeScale } = getHandleGeometry(handle);
  const screenDx = pointerX - (rect.left + rect.width / 2);
  const screenDy = pointerY - (rect.top + rect.height / 2);
  return { safeScale, screenDx, screenDy, distanceSq: screenDx * screenDx + screenDy * screenDy };
}
