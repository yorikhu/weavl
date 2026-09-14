const thousandsFormatter = new Intl.NumberFormat("en-US");

export function formatNumber(value: number): string {
  return thousandsFormatter.format(value);
}
