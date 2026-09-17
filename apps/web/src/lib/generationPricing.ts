import type { GenerationPriceQuote } from "@weavl/shared";

const rateFormatter = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 });

/**
 * 将服务端报价转换为提示词面板中的简短计费文案。
 * Token 模型展示每百万 Token 单价，固定价格模型展示本次预估积分。
 *
 * @param quote - 服务端返回的积分报价。
 * @returns 适合与钱币图标并排展示的文案；尚无报价时返回省略号。
 */
export function formatGenerationPrice(quote: GenerationPriceQuote | null) {
  if (!quote) return "…";
  if (quote.billingMode === "metered" && quote.meteredRates?.length) {
    const rates = quote.meteredRates
      .filter((rate) => rate.key !== "input_cache_write")
      .slice(0, 2)
      .map((rate) => `${rate.label} ${rateFormatter.format(rate.creditsPerMTokens)}`)
      .join(" · ");
    return `${rates} / 百万 Token`;
  }
  if (quote.quotable) return `${rateFormatter.format(quote.credits)} 预估`;
  return "生成后结算";
}
