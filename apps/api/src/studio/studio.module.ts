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
  ],
  providers: [StudioStore, SessionGuard],
})
export class StudioModule {}
