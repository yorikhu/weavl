import { API } from "./env";
import type { GenerationPriceQuote, GenerationQuoteRequest } from "@weavl/shared";

/**
 * 统一调用 Studio API 并将非成功响应转换为 Error。
 *
 * @template T - 预期响应体类型。
 * @param path - 相对于 Studio API 根地址的路径。
 * @param init - Fetch 请求配置。
 * @returns 解析后的 JSON 响应。
 * @throws {Error} 服务端返回非成功状态时抛出。
 */
export async function studioApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    credentials: "include",
    headers: { ...(init.body ? { "Content-Type": "application/json" } : {}), ...init.headers },
  });
  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as { message?: string | string[] } | null;
    throw new Error(
      Array.isArray(error?.message) ? error.message[0] : error?.message || `请求失败 (${response.status})`,
    );
  }
  return response.json() as Promise<T>;
}

/**
 * 将 API 请求数据序列化为 JSON 字符串。
 *
 * @param value - 可序列化的请求数据。
 * @returns JSON 请求体。
 */
export const jsonBody = (value: unknown) => JSON.stringify(value);

/**
 * 根据模型和生成参数获取服务端积分预估，不进行预扣或创建用量记录。
 *
 * @param request - 稳定模型标识与影响计费的参数。
 * @returns 当前计价规则下的积分预估。
 */
export function quoteGeneration(request: GenerationQuoteRequest) {
  return studioApi<GenerationPriceQuote>("/studio/billing/quote", {
    method: "POST",
    body: jsonBody(request),
  });
}
