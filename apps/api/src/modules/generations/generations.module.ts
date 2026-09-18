import { Module } from "@nestjs/common";
import { AssetsModule } from "../assets/assets.module";
import { BillingModule } from "../billing/billing.module";
import { IntegrationsModule } from "../integrations/integrations.module";
import { MediaGenerationController } from "./media-generation.controller";
import { MediaGenerationService } from "./media-generation.service";
import { TextGenerationController } from "./text-generation.controller";
import { TextGenerationService } from "./text-generation.service";
import { GenerationTaskQueue } from "./generation-task.queue";
import { GenerationTaskDispatcher } from "./generation-task.dispatcher";
import { GenerationTaskWorker } from "./generation-task.worker";
import { ImageGenerationService } from "./image-generation.service";
import { GenerationUserConcurrencyService } from "./generation-user-concurrency.service";
@Module({
  imports: [IntegrationsModule, AssetsModule, BillingModule],
  controllers: [TextGenerationController, MediaGenerationController],
  providers: [
    TextGenerationService,
    MediaGenerationService,
    ImageGenerationService,
    GenerationTaskQueue,
    GenerationTaskDispatcher,
    GenerationTaskWorker,
    GenerationUserConcurrencyService,
  ],
  exports: [TextGenerationService],
})
export class GenerationsModule {}
