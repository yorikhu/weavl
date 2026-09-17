import { Module } from "@nestjs/common";
import { IntegrationsController } from "./integrations.controller";
import { IntegrationConfigService } from "./integration-config.service";
import { ModelGatewayService } from "./model-gateway.service";
import { OpenAiCompatibleAdapter } from "./providers/openai-compatible.adapter";
import { OpenAiImageAdapter } from "./providers/openai-image.adapter";
import { ProviderHttpService } from "./providers/provider-http.service";
import { VertexImageAdapter } from "./providers/vertex-image.adapter";
import { VertexVideoAdapter } from "./providers/vertex-video.adapter";
import { ProviderRegistryService } from "./provider-registry.service";
import { ProviderPriceSyncService } from "./provider-price-sync.service";
@Module({
  controllers: [IntegrationsController],
  providers: [
    IntegrationConfigService,
    ProviderPriceSyncService,
    ProviderRegistryService,
    ModelGatewayService,
    ProviderHttpService,
    OpenAiCompatibleAdapter,
    OpenAiImageAdapter,
    VertexImageAdapter,
    VertexVideoAdapter,
  ],
  exports: [ProviderRegistryService, ModelGatewayService],
})
export class IntegrationsModule {}
