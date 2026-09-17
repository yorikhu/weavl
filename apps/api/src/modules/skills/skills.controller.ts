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
  /**
   * 读取Skill列表。
   *
   * @param r - 该操作所需的业务参数。
   * @returns 读取Skill列表后的结果。
   */
  @Get() list(@Req() r: AuthRequest) {
    return this.skills.list(r.studioUser.id);
  }
  /**
   * 创建Skill。
   *
   * @param r - 该操作所需的业务参数。
   * @param b - 该操作所需的业务参数。
   * @returns 创建Skill后的结果。
   */
  @Post() create(@Req() r: AuthRequest, @Body() b: unknown) {
    const { type: _type, ...x } = parseBody(schema, b);
    void _type;
    return this.skills.create(r.studioUser.id, x);
  }
  /**
   * 更新Skill。
   *
   * @param r - 该操作所需的业务参数。
   * @param id - 资源标识。
   * @param b - 该操作所需的业务参数。
   * @returns 更新Skill后的结果。
   */
  @Patch(":id") update(@Req() r: AuthRequest, @Param("id") id: string, @Body() b: unknown) {
    const { type: _type, ...x } = parseBody(schema.partial(), b);
    void _type;
    return this.skills.update(id, r.studioUser.id, x);
  }
  /**
   * 删除Skill。
   *
   * @param r - 该操作所需的业务参数。
   * @param id - 资源标识。
   * @returns 删除Skill后的结果。
   */
  @Delete(":id") remove(@Req() r: AuthRequest, @Param("id") id: string) {
    return this.skills.remove(id, r.studioUser.id);
  }
}
