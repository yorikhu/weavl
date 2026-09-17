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

const TEXT_EDITABLE_SELECTOR = "input, textarea, select, [contenteditable='true']";

/**
 * 判断键盘事件是否来自文本或表单编辑区域。
 *
 * @param target - 原生键盘事件目标。
 * @returns 目标是否应保留浏览器自身的编辑快捷键。
 */
export function isTextEditingTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest(TEXT_EDITABLE_SELECTOR));
}

/**
 * 从真实 pointerdown 目标解析节点标识，节点内部控件不会触发聚焦切换。
 *
 * @param target - 原生指针事件目标。
 * @returns 命中的 React Flow 节点标识；未命中或命中控件时返回 `null`。
 */
export function getCanvasNodePointerTarget(target: EventTarget | null): string | null {
  if (!(target instanceof Element) || target.closest(NODE_POINTER_CONTROL_SELECTOR)) return null;
  return target.closest<HTMLElement>(".react-flow__node")?.dataset.id ?? null;
}

/**
 * 判断双击是否发生在允许唤起添加菜单的画布空白处。
 *
 * @param target - 原生双击事件目标。
 * @param addMenuClassName - 添加菜单根元素的可选类名，用于排除菜单内部点击。
 * @returns 事件是否应打开画布添加菜单。
 */
export function isCanvasBackgroundTarget(target: EventTarget | null, addMenuClassName?: string): boolean {
  if (!(target instanceof Element)) return false;
  if (target.closest(CANVAS_INTERACTIVE_SELECTOR)) return false;
  if (!addMenuClassName) return true;
  return !target.closest(`.${addMenuClassName}`);
}
