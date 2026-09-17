import { Module } from "@nestjs/common";
import { IntegrationsController } from "./integrations.controller";
import { ModelGatewayService } from "./model-gateway.service";
import { OpenAiCompatibleAdapter } from "./providers/openai-compatible.adapter";
import { ProviderHttpService } from "./providers/provider-http.service";
import { VertexImageAdapter } from "./providers/vertex-image.adapter";
import { VertexVideoAdapter } from "./providers/vertex-video.adapter";
import { ProviderRegistryService } from "./provider-registry.service";
@Module({
  controllers: [IntegrationsController],
  providers: [
    ProviderRegistryService,
    ModelGatewayService,
    ProviderHttpService,
    OpenAiCompatibleAdapter,
    VertexImageAdapter,
    VertexVideoAdapter,
  ],
  exports: [ProviderRegistryService, ModelGatewayService],
})
export class IntegrationsModule {}
