import { Module } from "@nestjs/common";
import { HealthController } from "./health/health.controller";
import { TemplatesModule } from "./templates/templates.module";
import { RunsModule } from "./runs/runs.module";
import { StudioModule } from "./studio/studio.module";

@Module({
  imports: [TemplatesModule, RunsModule, StudioModule],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
