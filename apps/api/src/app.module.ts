import { Module } from "@nestjs/common";
import { HealthController } from "./health/health.controller";
import { BootstrapModule } from "./infrastructure/bootstrap/bootstrap.module";
import { CacheModule } from "./infrastructure/cache/cache.module";
import { DatabaseModule } from "./infrastructure/database/database.module";
import { StorageModule } from "./infrastructure/storage/storage.module";
import { AccountModule } from "./modules/account/account.module";
import { AssetsModule } from "./modules/assets/assets.module";
import { AuthModule } from "./modules/auth/auth.module";
import { ConversationsModule } from "./modules/conversations/conversations.module";
import { GenerationsModule } from "./modules/generations/generations.module";
import { IntegrationsModule } from "./modules/integrations/integrations.module";
import { ProjectsModule } from "./modules/projects/projects.module";
import { SkillsModule } from "./modules/skills/skills.module";
import { WorkflowsModule } from "./modules/workflows/workflows.module";
import { RunsModule } from "./modules/runs/runs.module";
import { TemplatesModule } from "./modules/templates/templates.module";

@Module({
  imports: [
    DatabaseModule,
    CacheModule,
    StorageModule,
    BootstrapModule,
    AuthModule,
    AccountModule,
    AssetsModule,
    ProjectsModule,
    SkillsModule,
    IntegrationsModule,
    GenerationsModule,
    ConversationsModule,
    WorkflowsModule,
    TemplatesModule,
    RunsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
