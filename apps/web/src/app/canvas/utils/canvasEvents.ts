const CANVAS_INTERACTIVE_SELECTOR = [
  ".react-flow__node",
  ".react-flow__edge",
  ".react-flow__controls",
  ".react-flow__minimap",
  "[data-canvas-group]",
  "button",
  "input",
  "textarea",
  "[contenteditable='true']",
].join(", ");

const NODE_POINTER_CONTROL_SELECTOR = [
  ".react-flow__handle",
  ".react-flow__resize-control",
  "button",
  "input",
  "textarea",
  "[contenteditable='true']",
  ".nodrag",
].join(", ");

/** 从真实 pointerdown 目标解析卡片，节点内部控件不触发聚焦切换。 */
export function getCanvasNodePointerTarget(target: EventTarget | null): string | null {
  if (!(target instanceof Element) || target.closest(NODE_POINTER_CONTROL_SELECTOR)) return null;
  return target.closest<HTMLElement>(".react-flow__node")?.dataset.id ?? null;
}

/** 判断双击是否发生在允许唤起添加菜单的画布空白处。 */
export function isCanvasBackgroundTarget(target: EventTarget | null, addMenuClassName?: string): boolean {
  if (!(target instanceof Element)) return false;
  if (target.closest(CANVAS_INTERACTIVE_SELECTOR)) return false;
  if (!addMenuClassName) return true;
  return !target.closest(`.${addMenuClassName}`);
}
