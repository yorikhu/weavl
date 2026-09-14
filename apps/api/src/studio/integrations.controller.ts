import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import type { AuthRequest } from "./http";
import { SessionGuard } from "./http";

/** 未来适配器的配置边界：这里只报告配置状态，不返回凭据，也不假装已接通。 */
export interface ProviderConfig {
  id: "volcengine" | "aliyun" | "zenmux";
  baseUrl?: string;
  apiKey?: string;
  timeoutMs: number;
}

export function providerConfigs(): ProviderConfig[] {
  const timeoutMs = Number(process.env.WEAVL_PROVIDER_TIMEOUT_MS || 30000);
  return [
    { id: "volcengine", baseUrl: process.env.VOLCENGINE_BASE_URL, apiKey: process.env.VOLCENGINE_API_KEY, timeoutMs },
    { id: "aliyun", baseUrl: process.env.ALIYUN_BASE_URL, apiKey: process.env.ALIYUN_API_KEY, timeoutMs },
    { id: "zenmux", baseUrl: process.env.ZENMUX_BASE_URL, apiKey: process.env.ZENMUX_API_KEY, timeoutMs },
  ];
}

@Controller("studio/integrations")
@UseGuards(SessionGuard)
export class IntegrationsController {
  @Get() status(@Req() _request: AuthRequest) {
    void _request;
    return {
      mode: "mock",
      persistence: "local-json",
      providers: providerConfigs().map(({ id, baseUrl, apiKey }) => ({
        id,
        configured: Boolean(baseUrl && apiKey),
        active: false,
      })),
      nextStorage: {
        postgresConfigured: Boolean(process.env.DATABASE_URL),
        redisConfigured: Boolean(process.env.REDIS_URL),
        objectStoreConfigured: Boolean(process.env.OBJECT_STORAGE_ENDPOINT && process.env.OBJECT_STORAGE_BUCKET),
      },
    };
  }
}
