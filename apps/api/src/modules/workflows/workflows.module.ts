import { Module } from "@nestjs/common";
import { AssetsModule } from "../assets/assets.module";
import { ProjectsModule } from "../projects/projects.module";
import { WorkflowsController } from "./workflows.controller";
import { WorkflowsService } from "./workflows.service";
@Module({ imports: [AssetsModule, ProjectsModule], controllers: [WorkflowsController], providers: [WorkflowsService] })
export class WorkflowsModule {}
