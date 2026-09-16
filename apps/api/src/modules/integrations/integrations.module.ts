import { Module } from "@nestjs/common";
import { IntegrationsController } from "./integrations.controller";
import { ModelGatewayService } from "./model-gateway.service";
import { OpenAiCompatibleAdapter } from "./providers/openai-compatible.adapter";
import { ProviderRegistryService } from "./provider-registry.service";
@Module({
  controllers: [IntegrationsController],
  providers: [ProviderRegistryService, ModelGatewayService, OpenAiCompatibleAdapter],
  exports: [ProviderRegistryService, ModelGatewayService],
})
export class IntegrationsModule {}
