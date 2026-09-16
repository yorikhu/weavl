import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { AuthRequest, parseBody } from "../../common/http";
import { SessionGuard } from "../auth/session.guard";
import { ProjectsService } from "./projects.service";
const canvasSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  nodes: z.array(z.unknown()).optional(),
  edges: z.array(z.unknown()).optional(),
  viewport: z.object({ x: z.number(), y: z.number(), zoom: z.number() }).optional(),
});
const coverSchema = z
  .string()
  .max(3_000_000)
  .regex(/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/, "封面仅支持 PNG、JPEG 或 WebP 图片");
@Controller("studio/projects")
@UseGuards(SessionGuard)
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}
  @Get() list(@Req() req: AuthRequest, @Query("trash") trash?: string) {
    return this.projects.list(req.studioUser.id, trash === "1");
  }
  @Get("folders") folders(@Req() req: AuthRequest) {
    return this.projects.listFolders(req.studioUser.id);
  }
  @Post("folders") createFolder(@Req() req: AuthRequest, @Body() body: unknown) {
    const x = parseBody(z.object({ name: z.string().trim().min(1).max(80) }), body);
    return this.projects.createFolder(req.studioUser.id, x.name);
  }
  @Patch("folders/:id") renameFolder(@Req() req: AuthRequest, @Param("id") id: string, @Body() body: unknown) {
    const x = parseBody(z.object({ name: z.string().trim().min(1).max(80) }), body);
    return this.projects.renameFolder(id, req.studioUser.id, x.name);
  }
  @Delete("folders/:id") deleteFolder(@Req() req: AuthRequest, @Param("id") id: string) {
    return this.projects.deleteFolder(id, req.studioUser.id);
  }
  @Get(":id") get(@Req() req: AuthRequest, @Param("id") id: string) {
    return this.projects.get(id, req.studioUser.id);
  }
  @Post() create(@Req() req: AuthRequest, @Body() body: unknown) {
    const x = parseBody(
      z.object({
        name: z.string().trim().min(1).max(80).default("未命名项目"),
        assetIds: z.array(z.string()).default([]),
        folderId: z.string().nullable().optional(),
      }),
      body,
    );
    return this.projects.create(req.studioUser.id, x);
  }
  @Patch(":id") update(@Req() req: AuthRequest, @Param("id") id: string, @Body() body: unknown) {
    const x = parseBody(
      z.object({
        name: z.string().trim().min(1).max(80).optional(),
        folderId: z.string().nullable().optional(),
        coverUrl: coverSchema.nullable().optional(),
      }),
      body,
    );
    return this.projects.update(id, req.studioUser.id, x);
  }
  @Post(":id/duplicate") duplicate(@Req() req: AuthRequest, @Param("id") id: string) {
    return this.projects.duplicate(id, req.studioUser.id);
  }
  @Delete(":id") remove(@Req() req: AuthRequest, @Param("id") id: string) {
    return this.projects.softDelete(id, req.studioUser.id);
  }
  @Post(":id/restore") restore(@Req() req: AuthRequest, @Param("id") id: string) {
    return this.projects.restore(id, req.studioUser.id);
  }
  @Delete(":id/permanent") permanent(@Req() req: AuthRequest, @Param("id") id: string) {
    return this.projects.permanentDelete(id, req.studioUser.id);
  }
  @Post(":id/canvases") addCanvas(@Req() req: AuthRequest, @Param("id") id: string, @Body() body: unknown) {
    const x = parseBody(z.object({ name: z.string().trim().min(1).max(80).optional() }), body);
    return this.projects.addCanvas(id, req.studioUser.id, x.name);
  }
  @Patch(":id/canvases/:canvasId") saveCanvas(
    @Req() req: AuthRequest,
    @Param("id") id: string,
    @Param("canvasId") canvasId: string,
    @Body() body: unknown,
  ) {
    return this.projects.saveCanvas(id, canvasId, req.studioUser.id, parseBody(canvasSchema, body));
  }
  @Delete(":id/canvases/:canvasId") deleteCanvas(
    @Req() req: AuthRequest,
    @Param("id") id: string,
    @Param("canvasId") canvasId: string,
  ) {
    return this.projects.deleteCanvas(id, canvasId, req.studioUser.id);
  }
}
