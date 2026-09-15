import { Module } from "@nestjs/common";
import { AssetsController, FoldersController } from "./assets.controller";
import { AuthController } from "./auth.controller";
import { ConversationsController } from "./conversations.controller";
import { MarketController } from "./market.controller";
import { ProjectsController } from "./projects.controller";
import { WorkflowsController } from "./workflows.controller";
import { IntegrationsController } from "./integrations.controller";
import { AccountController } from "./account.controller";
import { SessionGuard } from "./http";
import { StudioStore } from "./store";
import { TextGenerationController } from "./text-generation.controller";
import { TextGenerationService } from "./text-generation.service";

@Module({
  controllers: [
    AuthController,
    AssetsController,
    FoldersController,
    ProjectsController,
    ConversationsController,
    MarketController,
    WorkflowsController,
    IntegrationsController,
    AccountController,
    TextGenerationController,
  ],
  providers: [StudioStore, SessionGuard, TextGenerationService],
})
export class StudioModule {}
