import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { AuthRequest, parseBody } from "../../common/http";
import { SessionGuard } from "../auth/session.guard";
import { ConversationsService } from "./conversations.service";
@Controller("studio/conversations")
@UseGuards(SessionGuard)
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService) {}
  /**
   * 读取Agent 会话列表。
   *
   * @param r - 该操作所需的业务参数。
   * @returns 读取Agent 会话列表后的结果。
   */
  @Get() list(@Req() r: AuthRequest) {
    return this.conversations.list(r.studioUser.id);
  }
  /**
   * 读取Agent 会话详情。
   *
   * @param r - 该操作所需的业务参数。
   * @param id - 资源标识。
   * @returns 读取Agent 会话详情后的结果。
   */
  @Get(":id") get(@Req() r: AuthRequest, @Param("id") id: string) {
    return this.conversations.get(id, r.studioUser.id);
  }
  /**
   * 创建Agent 会话。
   *
   * @param r - 该操作所需的业务参数。
   * @param b - 该操作所需的业务参数。
   * @returns 创建Agent 会话后的结果。
   */
  @Post() create(@Req() r: AuthRequest, @Body() b: unknown) {
    const x = parseBody(z.object({ title: z.string().trim().min(1).max(100).default("新会话") }), b);
    return this.conversations.create(r.studioUser.id, x.title);
  }
  /**
   * 更新Agent 会话。
   *
   * @param r - 该操作所需的业务参数。
   * @param id - 资源标识。
   * @param b - 该操作所需的业务参数。
   * @returns 更新Agent 会话后的结果。
   */
  @Patch(":id") update(@Req() r: AuthRequest, @Param("id") id: string, @Body() b: unknown) {
    const x = parseBody(
      z.object({
        title: z.string().trim().min(1).max(100).optional(),
        archived: z.boolean().optional(),
        projectId: z.string().optional(),
      }),
      b,
    );
    return this.conversations.update(id, r.studioUser.id, x);
  }
  /**
   * 发送 Agent 会话消息。
   *
   * @param r - 该操作所需的业务参数。
   * @param id - 资源标识。
   * @param b - 该操作所需的业务参数。
   * @returns 发送 Agent 会话消息后的结果。
   */
  @Post(":id/messages") send(@Req() r: AuthRequest, @Param("id") id: string, @Body() b: unknown) {
    const x = parseBody(
      z.object({
        content: z.string().trim().min(1).max(10000),
        assetIds: z.array(z.string()).default([]),
        marketEntryIds: z.array(z.string()).max(20).optional(),
        modelKinds: z
          .array(z.enum(["text", "image", "video", "audio", "avatar"]))
          .max(5)
          .optional(),
        marketEntryId: z.string().optional(),
        modelKind: z.enum(["text", "image", "video", "audio", "avatar"]).optional(),
      }),
      b,
    );
    return this.conversations.send(id, r.studioUser.id, x);
  }
  /**
   * 将会话转换为项目。
   *
   * @param r - 该操作所需的业务参数。
   * @param id - 资源标识。
   * @param b - 该操作所需的业务参数。
   * @returns 将会话转换为项目后的结果。
   */
  @Post(":id/project") project(@Req() r: AuthRequest, @Param("id") id: string, @Body() b: unknown) {
    const x = parseBody(
      z.object({ assetIds: z.array(z.string()).default([]), name: z.string().trim().min(1).max(80).optional() }),
      b,
    );
    return this.conversations.toProject(id, r.studioUser.id, x.assetIds, x.name);
  }
  /**
   * 删除Agent 会话。
   *
   * @param r - 该操作所需的业务参数。
   * @param id - 资源标识。
   * @returns 删除Agent 会话后的结果。
   */
  @Delete(":id") remove(@Req() r: AuthRequest, @Param("id") id: string) {
    return this.conversations.remove(id, r.studioUser.id);
  }
}
