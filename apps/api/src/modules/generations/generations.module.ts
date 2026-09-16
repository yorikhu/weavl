import { Module } from "@nestjs/common";
import { IntegrationsModule } from "../integrations/integrations.module";
import { TextGenerationController } from "./text-generation.controller";
import { TextGenerationService } from "./text-generation.service";
@Module({
  imports: [IntegrationsModule],
  controllers: [TextGenerationController],
  providers: [TextGenerationService],
  exports: [TextGenerationService],
})
export class GenerationsModule {}
