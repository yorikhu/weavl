import { Module } from "@nestjs/common";
import { HealthController } from "./health/health.controller";
import { TemplatesModule } from "./templates/templates.module";
import { RunsModule } from "./runs/runs.module";

@Module({
  imports: [TemplatesModule, RunsModule],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
