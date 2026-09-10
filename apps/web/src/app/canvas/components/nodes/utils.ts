/**
 * 浅比较两个扁平对象，避免 React Flow 视口选择器产生无效更新。
 *
 * @param a - 前一次选择器结果。
 * @param b - 当前选择器结果。
 * @returns 所有一级键和值是否一致。
 */
export function shallowEqual(a: Record<string, unknown>, b: Record<string, unknown>) {
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;

  return keys.every((key) => a[key] === b[key]);
}
