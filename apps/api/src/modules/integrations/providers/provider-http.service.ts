import { BadGatewayException, Injectable } from "@nestjs/common";
import type { ProviderChannel } from "../provider.types";

/** 为供应商适配器提供统一鉴权、超时和 HTTP 错误归一化。 */
@Injectable()
export class ProviderHttpService {
  /**
   * 向渠道端点发送 JSON POST 请求。
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
    const controller = new AbortController();
    const kindTimeout = process.env[`WEAVL_${channel.modelKind.toUpperCase()}_TIMEOUT_MS`];
    const timeout = Number(kindTimeout || process.env.WEAVL_PROVIDER_TIMEOUT_MS || 30000);
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!response.ok) {
        const detail = (await response.text()).slice(0, 500);
        throw Object.assign(new Error(`模型服务返回 ${response.status}${detail ? `：${detail}` : ""}`), {
          statusCode: response.status,
        });
      }
      return { data: (await response.json()) as T, statusCode: response.status };
    } catch (error) {
      if ((error as Error).name === "AbortError") throw new BadGatewayException(`渠道 ${channel.label} 请求超时`);
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}
