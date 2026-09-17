"use client";

import { useEffect, useState } from "react";
import type { GenerationPriceQuote } from "@weavl/shared";
import { quoteGeneration } from "@/lib/studioApi";

interface UseGenerationQuoteOptions {
  modelId: string;
  parameters: Record<string, unknown>;
  enabled?: boolean;
  delay?: number;
}

/**
 * 合并短时间内连续变化的生成参数，并获取不产生扣费的积分预估。
 *
 * @param options - 模型、计费参数、启用状态和延迟毫秒数。
 * @returns 最新报价；请求尚未完成或失败时为 `null`。
 */
export function useGenerationQuote({
  modelId,
  parameters,
  enabled = true,
  delay = 300,
}: UseGenerationQuoteOptions) {
  const [quote, setQuote] = useState<GenerationPriceQuote | null>(null);
  const serializedParameters = JSON.stringify(parameters);

  useEffect(() => {
    if (!enabled || !modelId) {
      setQuote(null);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void quoteGeneration({
        modelId,
        parameters: JSON.parse(serializedParameters) as Record<string, unknown>,
      })
        .then((result) => {
          if (!controller.signal.aborted) setQuote(result);
        })
        .catch(() => {
          if (!controller.signal.aborted) setQuote(null);
        });
    }, delay);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [delay, enabled, modelId, serializedParameters]);

  return quote;
}
