import { BadGatewayException, Injectable } from "@nestjs/common";
import type { ProviderChannel } from "../provider.types";

interface ProviderRequestError extends Error {
  statusCode?: number;
  requestId?: string;
  retryAfterMs?: number;
}

const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504, 520, 524]);

/** 为供应商适配器提供统一鉴权、超时和 HTTP 错误归一化。 */
@Injectable()
export class ProviderHttpService {
  /**
   * 向渠道端点发送 JSON 或 multipart POST 请求。
   * 超时优先读取对应模型类型的配置，再回退到全局供应商超时配置。
   *
   * @template T - 供应商 JSON 响应的数据结构。
   * @param channel - 提供鉴权环境变量和模型类型的供应渠道。
   * @param url - 完整供应商请求地址。
   * @param body - 可序列化为 JSON 的请求体。
   * @returns 解析后的响应数据和 HTTP 状态码。
   * @throws {BadGatewayException} 缺少渠道密钥或请求超时时抛出。
   */
  async post<T>(channel: ProviderChannel, url: string, body: unknown): Promise<{ data: T; statusCode: number }> {
    const key = process.env[channel.apiKeyEnv];
    if (!key) throw new BadGatewayException(`渠道 ${channel.label} 缺少 ${channel.apiKeyEnv}`);
    const kindTimeout = process.env[`WEAVL_${channel.modelKind.toUpperCase()}_TIMEOUT_MS`];
    const timeout = Number(kindTimeout || process.env.WEAVL_PROVIDER_TIMEOUT_MS || 30000);
    const multipart = body instanceof FormData;
    const requestBody = multipart ? body : JSON.stringify(body);
    const maxAttempts = this.maxAttempts(channel);
    let lastError: ProviderRequestError | undefined;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            ...(multipart ? {} : { "Content-Type": "application/json" }),
          },
          body: requestBody,
          signal: controller.signal,
        });
        if (!response.ok) {
          const detail = (await response.text()).slice(0, 500);
          const requestId =
            response.headers.get("x-zenmux-request-id") || response.headers.get("x-request-id") || undefined;
          const retryAfter = Number(response.headers.get("retry-after"));
          throw Object.assign(
            new Error(
              `模型服务返回 ${response.status}${detail ? `：${detail}` : ""}${requestId ? `（请求号：${requestId}）` : ""}`,
            ),
            {
              statusCode: response.status,
              requestId,
              retryAfterMs: Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : undefined,
            },
          );
        }
        return { data: (await response.json()) as T, statusCode: response.status };
      } catch (cause) {
        const error: ProviderRequestError =
          (cause as Error).name === "AbortError"
            ? (Object.assign(new BadGatewayException(`渠道 ${channel.label} 请求超时`), {
                statusCode: 504,
              }) as ProviderRequestError)
            : (cause as ProviderRequestError);
        lastError = error;
        if (attempt + 1 >= maxAttempts || !this.isRetryable(error)) throw error;
        await this.waitBeforeRetry(attempt, error.retryAfterMs);
      } finally {
        clearTimeout(timer);
      }
    }

    throw lastError ?? new BadGatewayException(`渠道 ${channel.label} 请求失败`);
  }

  /**
   * 返回当前模型类型的单渠道最大请求次数。
   *
   * @param channel - 当前供应渠道，用于读取模型类型专属配置。
   * @returns 限制在 1 至 4 次的请求次数。
   */
  private maxAttempts(channel: ProviderChannel) {
    const kindAttempts = process.env[`WEAVL_${channel.modelKind.toUpperCase()}_MAX_ATTEMPTS`];
    const fallbackAttempts = Number(process.env.WEAVL_PROVIDER_MAX_ATTEMPTS || 2);
    const configured = Number(kindAttempts || fallbackAttempts);
    return Number.isFinite(configured) ? Math.min(4, Math.max(1, Math.trunc(configured))) : fallbackAttempts;
  }

  /** 判断供应商错误是否适合在同一渠道短暂退避后重试。 */
  private isRetryable(error: ProviderRequestError) {
    return error.statusCode !== undefined && RETRYABLE_STATUS_CODES.has(error.statusCode);
  }

  /** 按指数退避等待；供应商 Retry-After 的优先级高于本地退避配置。 */
  private waitBeforeRetry(attempt: number, retryAfterMs?: number) {
    const configured = Number(process.env.WEAVL_PROVIDER_RETRY_BASE_MS || 750);
    const baseMs = Number.isFinite(configured) && configured >= 0 ? configured : 750;
    const backoffMs = retryAfterMs ?? baseMs * 2 ** attempt + Math.floor(Math.random() * 200);
    return new Promise<void>((resolve) => setTimeout(resolve, backoffMs));
  }
}
