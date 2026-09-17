import type { GenerationPriceQuote } from "@weavl/shared";

const creditFormatter = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 0 });

/**
 * 将服务端报价转换为提示词面板中的简短计费文案。
 * 用户只需理解一次生成消耗的积分，供应商费率和 Token 单价留在后台管理。
 *
 * @param quote - 服务端返回的积分报价。
 * @returns 适合与钱币图标并排展示的文案；尚无报价时返回省略号。
 */
export function formatGenerationPrice(quote: GenerationPriceQuote | null) {
  if (!quote) return "暂不可用";
  if (quote.quotable) return `${creditFormatter.format(Math.ceil(quote.credits))} 积分`;
  return "暂不可用";
}
