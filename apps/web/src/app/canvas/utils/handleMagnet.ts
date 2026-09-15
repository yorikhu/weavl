const CARD_HANDLE_VISUAL_OFFSET = 15;

export interface HandleScreenDistance {
  safeScale: number;
  screenDx: number;
  screenDy: number;
  distanceSq: number;
}

/**
 * 判断连接点是否属于有效卡片。
 * 多选与整组屏蔽由调用侧结合完整选择状态处理。
 *
 * @param handle - 候选连接点元素。
 * @returns 连接点是否位于 React Flow 节点内。
 */
export function isCardHandleInteractive(handle: HTMLElement): boolean {
  return Boolean(handle.closest<HTMLElement>(".react-flow__node"));
}

/**
 * 判断指针是否从节点或组的可拖动表面按下。
 * 命中时磁吸系统应暂停到本次移动手势结束。
 *
 * @param target - 原生指针事件目标。
 * @returns 是否属于会触发画布对象移动的目标。
 */
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
 *
 * @param handle - 要检查的卡片连接点元素。
 * @returns 连接点所在边缘是否未被更高层组框遮挡。
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

/**
 * 计算卡片连接圆点与指针的屏幕距离，卡片内部不属于吸附区域。
 *
 * @param handle - 卡片连接点元素。
 * @param pointerX - 指针的视口横坐标。
 * @param pointerY - 指针的视口纵坐标。
 * @returns 屏幕距离和安全缩放值；指针位于卡片内部时返回 `null`。
 */
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

/**
 * 计算视觉圆点位于元素中心时与指针的屏幕距离。
 *
 * @param handle - 批量连接点或其他居中连接点元素。
 * @param pointerX - 指针的视口横坐标。
 * @param pointerY - 指针的视口纵坐标。
 * @returns 屏幕距离和安全缩放值。
 */
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
