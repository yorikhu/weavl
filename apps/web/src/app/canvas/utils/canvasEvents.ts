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

/** 判断双击是否发生在允许唤起添加菜单的画布空白处。 */
export function isCanvasBackgroundTarget(target: EventTarget | null, addMenuClassName?: string): boolean {
  if (!(target instanceof Element)) return false;
  if (target.closest(CANVAS_INTERACTIVE_SELECTOR)) return false;
  if (!addMenuClassName) return true;
  return !target.closest(`.${addMenuClassName}`);
}
