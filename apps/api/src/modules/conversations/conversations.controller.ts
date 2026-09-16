import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { AuthRequest, parseBody } from "../../common/http";
import { SessionGuard } from "../auth/session.guard";
import { ConversationsService } from "./conversations.service";
@Controller("studio/conversations")
@UseGuards(SessionGuard)
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService) {}
  @Get() list(@Req() r: AuthRequest) {
    return this.conversations.list(r.studioUser.id);
  }
  @Get(":id") get(@Req() r: AuthRequest, @Param("id") id: string) {
    return this.conversations.get(id, r.studioUser.id);
  }
  @Post() create(@Req() r: AuthRequest, @Body() b: unknown) {
    const x = parseBody(z.object({ title: z.string().trim().min(1).max(100).default("新会话") }), b);
    return this.conversations.create(r.studioUser.id, x.title);
  }
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
  @Post(":id/project") project(@Req() r: AuthRequest, @Param("id") id: string, @Body() b: unknown) {
    const x = parseBody(
      z.object({ assetIds: z.array(z.string()).default([]), name: z.string().trim().min(1).max(80).optional() }),
      b,
    );
    return this.conversations.toProject(id, r.studioUser.id, x.assetIds, x.name);
  }
  @Delete(":id") remove(@Req() r: AuthRequest, @Param("id") id: string) {
    return this.conversations.remove(id, r.studioUser.id);
  }
}
