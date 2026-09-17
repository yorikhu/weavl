import { Module } from "@nestjs/common";
import { AssetsModule } from "../assets/assets.module";
import { GenerationsModule } from "../generations/generations.module";
import { ProjectsModule } from "../projects/projects.module";
import { SkillsModule } from "../skills/skills.module";
import { ConversationsController } from "./conversations.controller";
import { ConversationsService } from "./conversations.service";

@Module({
  imports: [AssetsModule, SkillsModule, ProjectsModule, GenerationsModule],
  controllers: [ConversationsController],
  providers: [ConversationsService],
})
export class ConversationsModule {}
