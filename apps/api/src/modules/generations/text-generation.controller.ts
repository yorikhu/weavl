import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { parseBody } from "../../common/http";
import { SessionGuard } from "../auth/session.guard";
import { TextGenerationService, type TextModelId } from "./text-generation.service";
const schema = z.object({
  model: z.enum(["weavl-text", "volcengine-text", "aliyun-text", "zenmux-text"]).default("weavl-text"),
  prompt: z.string().trim().min(1).max(10000),
});
@Controller("studio/generations/text")
@UseGuards(SessionGuard)
export class TextGenerationController {
  constructor(private readonly generation: TextGenerationService) {}
  @Get("models") models() {
    return this.generation.models();
  }
  @Post() generate(@Body() body: unknown) {
    const x = parseBody(schema, body);
    return this.generation.generate(x.model as TextModelId, x.prompt);
  }
}
