import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import type { AssetSource } from "@weavl/shared";
import { z } from "zod";
import { AuthRequest, parseBody } from "../../common/http";
import { SessionGuard } from "../auth/session.guard";
import { AssetsService } from "./assets.service";

const assetSchema = z.object({
  name: z.string().trim().min(1).max(180),
  kind: z.enum(["text", "image", "video", "audio", "pdf", "word", "ppt", "file"]),
  content: z.string().max(8_000_000),
  mimeType: z.string().max(120).optional(),
  folderId: z.string().nullable().optional(),
  inLibrary: z.boolean().optional(),
});

@Controller("studio/assets")
@UseGuards(SessionGuard)
export class AssetsController {
  constructor(private readonly assets: AssetsService) {}
  @Get() list(
    @Req() req: AuthRequest,
    @Query("source") source?: AssetSource,
    @Query("q") q?: string,
    @Query("trash") trash?: string,
    @Query("includeGenerated") includeGenerated?: string,
  ) {
    return this.assets.list(req.studioUser.id, {
      source,
      q,
      trash: trash === "1",
      includeGenerated: includeGenerated === "1",
    });
  }
  @Post() create(@Req() req: AuthRequest, @Body() body: unknown) {
    const input = parseBody(assetSchema, body);
    return this.assets.create({
      ...input,
      ownerId: req.studioUser.id,
      source: "personal",
      inLibrary: input.inLibrary ?? true,
    });
  }
  @Patch(":id") update(@Req() req: AuthRequest, @Param("id") id: string, @Body() body: unknown) {
    const input = parseBody(
      z.object({
        name: z.string().trim().min(1).max(180).optional(),
        folderId: z.string().nullable().optional(),
        content: z.string().max(8_000_000).optional(),
        inLibrary: z.boolean().optional(),
      }),
      body,
    );
    return this.assets.update(id, req.studioUser.id, input);
  }
  @Delete(":id") remove(@Req() req: AuthRequest, @Param("id") id: string) {
    return this.assets.softDelete(id, req.studioUser.id);
  }
  @Post(":id/restore") restore(@Req() req: AuthRequest, @Param("id") id: string) {
    return this.assets.restore(id, req.studioUser.id);
  }
}

@Controller("studio/folders")
@UseGuards(SessionGuard)
export class FoldersController {
  constructor(private readonly assets: AssetsService) {}
  @Get() list(@Req() req: AuthRequest) {
    return this.assets.listFolders(req.studioUser.id);
  }
  @Post() create(@Req() req: AuthRequest, @Body() body: unknown) {
    const input = parseBody(
      z.object({ name: z.string().trim().min(1).max(80), parentId: z.string().nullable().optional() }),
      body,
    );
    return this.assets.createFolder(req.studioUser.id, input.name, input.parentId);
  }
  @Patch(":id") update(@Req() req: AuthRequest, @Param("id") id: string, @Body() body: unknown) {
    const input = parseBody(z.object({ name: z.string().trim().min(1).max(80) }), body);
    return this.assets.renameFolder(id, req.studioUser.id, input.name);
  }
  @Delete(":id") remove(@Req() req: AuthRequest, @Param("id") id: string) {
    return this.assets.deleteFolder(id, req.studioUser.id);
  }
}
