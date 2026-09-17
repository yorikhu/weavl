import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { parseBody, type AuthRequest } from "../../common/http";
import { SessionGuard } from "../auth/session.guard";
import { TextGenerationService } from "./text-generation.service";
const schema = z.object({
  model: z.string().trim().min(1).default("deepseek-v4.1-flash"),
  prompt: z.string().trim().min(1).max(10000),
});

/** 对外提供文本模型目录和同步生成接口。 */
@Controller("studio/generations/text")
@UseGuards(SessionGuard)
export class TextGenerationController {
  constructor(private readonly generation: TextGenerationService) {}

  /**
   * 返回文本模型及其渠道配置状态。
   *
   * @returns 文本模型选择项列表。
   */
  @Get("models") models() {
    return this.generation.models();
  }

  /**
   * 校验输入后调用统一文本生成网关。
   *
   * @param request - 包含当前登录用户的请求对象。
   * @param body - 尚未校验的文本生成请求体。
   * @returns 实时模型结果或无密钥时的演示结果。
   */
  @Post() generate(@Req() request: AuthRequest, @Body() body: unknown) {
    const x = parseBody(schema, body);
    return this.generation.generate(request.studioUser.id, x.model, x.prompt);
  }
}
