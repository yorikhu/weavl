const thousandsFormatter = new Intl.NumberFormat("en-US");

/**
 * 使用中文千分位格式化数值。
 *
 * @param value - 需要格式化的数值。
 * @returns 带千分位分隔符的字符串。
 */
export function formatNumber(value: number): string {
  return thousandsFormatter.format(value);
}
