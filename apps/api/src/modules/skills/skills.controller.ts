import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { AuthRequest, parseBody } from "../../common/http";
import { SessionGuard } from "../auth/session.guard";
import { SkillsService } from "./skills.service";
const schema = z.object({
  type: z.literal("skill"),
  title: z.string().trim().min(1).max(100),
  description: z.string().trim().min(1).max(300),
  content: z.string().trim().min(1).max(10000),
  inputHint: z.string().max(200).default("文字说明"),
  outputKind: z.enum(["text", "image", "video", "audio", "pdf", "word", "ppt", "file"]).default("text"),
});
@Controller("studio/market")
@UseGuards(SessionGuard)
export class SkillsController {
  constructor(private readonly skills: SkillsService) {}
  @Get() list(@Req() r: AuthRequest) {
    return this.skills.list(r.studioUser.id);
  }
  @Post() create(@Req() r: AuthRequest, @Body() b: unknown) {
    const { type: _type, ...x } = parseBody(schema, b);
    void _type;
    return this.skills.create(r.studioUser.id, x);
  }
  @Patch(":id") update(@Req() r: AuthRequest, @Param("id") id: string, @Body() b: unknown) {
    const { type: _type, ...x } = parseBody(schema.partial(), b);
    void _type;
    return this.skills.update(id, r.studioUser.id, x);
  }
  @Delete(":id") remove(@Req() r: AuthRequest, @Param("id") id: string) {
    return this.skills.remove(id, r.studioUser.id);
  }
}
