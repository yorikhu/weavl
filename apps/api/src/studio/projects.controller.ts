import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import type { CanvasDocument, CanvasProject } from "@weavl/shared";
import { AuthRequest, owned, parseBody, SessionGuard } from "./http";
import { newId, StudioStore } from "./store";

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

function activeProject(projects: CanvasProject[], id: string, ownerId: string) {
  return owned(
    projects.filter((project) => !project.deletedAt),
    id,
    ownerId,
  );
}

@Controller("studio/projects")
@UseGuards(SessionGuard)
export class ProjectsController {
  constructor(private readonly store: StudioStore) {}

  @Get() list(@Req() req: AuthRequest, @Query("trash") trash?: string) {
    return this.store
      .read()
      .projects.filter(
        (project) => project.ownerId === req.studioUser.id && Boolean(project.deletedAt) === (trash === "1"),
      )
      .sort((a, b) =>
        trash === "1" ? (b.deletedAt || "").localeCompare(a.deletedAt || "") : b.updatedAt.localeCompare(a.updatedAt),
      );
  }

  @Get("folders")
  listFolders(@Req() req: AuthRequest) {
    return this.store.read().projectFolders.filter((folder) => folder.ownerId === req.studioUser.id);
  }

  @Post("folders")
  createFolder(@Req() req: AuthRequest, @Body() body: unknown) {
    const { name } = parseBody(z.object({ name: z.string().trim().min(1).max(80) }), body);
    const folder = {
      id: newId("project_folder"),
      ownerId: req.studioUser.id,
      name,
      createdAt: new Date().toISOString(),
    };
    this.store.update((state) => state.projectFolders.push(folder));
    return folder;
  }

  @Patch("folders/:id")
  renameFolder(@Req() req: AuthRequest, @Param("id") id: string, @Body() body: unknown) {
    const { name } = parseBody(z.object({ name: z.string().trim().min(1).max(80) }), body);
    return this.store.update((state) => {
      const folder = owned(state.projectFolders, id, req.studioUser.id);
      folder.name = name;
      return folder;
    });
  }

  @Delete("folders/:id")
  deleteFolder(@Req() req: AuthRequest, @Param("id") id: string) {
    return this.store.update((state) => {
      owned(state.projectFolders, id, req.studioUser.id);
      state.projects
        .filter((project) => project.ownerId === req.studioUser.id && project.folderId === id)
        .forEach((project) => {
          project.folderId = null;
        });
      state.projectFolders = state.projectFolders.filter((folder) => folder.id !== id);
      return { ok: true };
    });
  }

  @Get(":id") get(@Req() req: AuthRequest, @Param("id") id: string) {
    return activeProject(this.store.read().projects, id, req.studioUser.id);
  }

  @Post()
  create(@Req() req: AuthRequest, @Body() body: unknown): CanvasProject {
    const input = parseBody(
      z.object({
        name: z.string().trim().min(1).max(80).default("未命名项目"),
        assetIds: z.array(z.string()).default([]),
        folderId: z.string().nullable().optional(),
      }),
      body,
    );
    const timestamp = new Date().toISOString();
    if (input.folderId) owned(this.store.read().projectFolders, input.folderId, req.studioUser.id);
    const assets = input.assetIds.map((id) =>
      owned(
        this.store.read().assets.filter((asset) => !asset.deletedAt),
        id,
        req.studioUser.id,
      ),
    );
    const nodes = assets.map((asset, index) => ({
      id: newId("node"),
      type: asset.kind === "image" ? "image" : "text",
      position: { x: 140 + (index % 3) * 340, y: 120 + Math.floor(index / 3) * 260 },
      data:
        asset.kind === "image"
          ? {
              nodeKind: "image",
              kind: "image",
              category: "资产",
              tint: "rgba(0,0,0,.08)",
              size: { w: 300, h: 200 },
              title: asset.name,
              url: asset.versions.at(-1)?.content,
              assetRef: { assetId: asset.id, versionId: asset.versions.at(-1)!.id },
              source: asset.source,
            }
          : {
              nodeKind: "text",
              title: asset.name,
              text: asset.versions.at(-1)?.content || "",
              assetRef: { assetId: asset.id, versionId: asset.versions.at(-1)!.id },
              source: asset.source,
            },
    }));
    const canvas: CanvasDocument = {
      id: newId("canvas"),
      name: "画布 1",
      nodes,
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      updatedAt: timestamp,
    };
    const project: CanvasProject = {
      id: newId("project"),
      ownerId: req.studioUser.id,
      name: input.name,
      folderId: input.folderId || null,
      coverUrl: null,
      canvases: [canvas],
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.store.update((state) => state.projects.push(project));
    return project;
  }

  @Patch(":id") update(@Req() req: AuthRequest, @Param("id") id: string, @Body() body: unknown) {
    const input = parseBody(
      z.object({
        name: z.string().trim().min(1).max(80).optional(),
        folderId: z.string().nullable().optional(),
        coverUrl: coverSchema.nullable().optional(),
      }),
      body,
    );
    if (input.folderId) owned(this.store.read().projectFolders, input.folderId, req.studioUser.id);
    return this.store.update((state) => {
      const project = activeProject(state.projects, id, req.studioUser.id);
      if (input.name !== undefined) project.name = input.name;
      if (input.folderId !== undefined) project.folderId = input.folderId;
      if (input.coverUrl !== undefined) project.coverUrl = input.coverUrl;
      project.updatedAt = new Date().toISOString();
      return project;
    });
  }

  @Post(":id/duplicate")
  duplicate(@Req() req: AuthRequest, @Param("id") id: string): CanvasProject {
    return this.store.update((state) => {
      const source = activeProject(state.projects, id, req.studioUser.id);
      const timestamp = new Date().toISOString();
      const canvases = source.canvases.map((canvas) => {
        const nodeIds = new Map<string, string>();
        const nodes = structuredClone(canvas.nodes).map((rawNode) => {
          if (!rawNode || typeof rawNode !== "object") return rawNode;
          const node = rawNode as { id?: string };
          if (!node.id) return node;
          const nextId = newId("node");
          nodeIds.set(node.id, nextId);
          node.id = nextId;
          return node;
        });
        const edges = structuredClone(canvas.edges).map((rawEdge) => {
          if (!rawEdge || typeof rawEdge !== "object") return rawEdge;
          const edge = rawEdge as { id?: string; source?: string; target?: string };
          if (edge.id) edge.id = newId("edge");
          if (edge.source) edge.source = nodeIds.get(edge.source) || edge.source;
          if (edge.target) edge.target = nodeIds.get(edge.target) || edge.target;
          return edge;
        });
        return { ...canvas, id: newId("canvas"), nodes, edges, updatedAt: timestamp };
      });
      const copy: CanvasProject = {
        ...source,
        id: newId("project"),
        name: `${source.name} 副本`,
        canvases,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      state.projects.push(copy);
      return copy;
    });
  }

  @Delete(":id") remove(@Req() req: AuthRequest, @Param("id") id: string) {
    return this.store.update((state) => {
      const project = activeProject(state.projects, id, req.studioUser.id);
      project.deletedAt = new Date().toISOString();
      return project;
    });
  }

  @Post(":id/restore")
  restore(@Req() req: AuthRequest, @Param("id") id: string) {
    return this.store.update((state) => {
      const project = owned(state.projects, id, req.studioUser.id);
      if (!project.deletedAt) throw new BadRequestException("项目不在回收站");
      delete project.deletedAt;
      project.updatedAt = new Date().toISOString();
      return project;
    });
  }

  @Delete(":id/permanent")
  deletePermanently(@Req() req: AuthRequest, @Param("id") id: string) {
    return this.store.update((state) => {
      const project = owned(state.projects, id, req.studioUser.id);
      if (!project.deletedAt) throw new BadRequestException("请先将项目移入回收站");
      state.projects = state.projects.filter((item) => item.id !== id);
      return { ok: true };
    });
  }

  @Post(":id/canvases")
  addCanvas(@Req() req: AuthRequest, @Param("id") id: string, @Body() body: unknown) {
    const input = parseBody(z.object({ name: z.string().trim().min(1).max(80).optional() }), body);
    return this.store.update((state) => {
      const project = activeProject(state.projects, id, req.studioUser.id);
      const canvas: CanvasDocument = {
        id: newId("canvas"),
        name: input.name || `画布 ${project.canvases.length + 1}`,
        nodes: [],
        edges: [],
        viewport: { x: 0, y: 0, zoom: 1 },
        updatedAt: new Date().toISOString(),
      };
      project.canvases.push(canvas);
      project.updatedAt = canvas.updatedAt;
      return canvas;
    });
  }

  @Patch(":id/canvases/:canvasId")
  saveCanvas(
    @Req() req: AuthRequest,
    @Param("id") id: string,
    @Param("canvasId") canvasId: string,
    @Body() body: unknown,
  ) {
    const input = parseBody(canvasSchema, body);
    return this.store.update((state) => {
      const project = activeProject(state.projects, id, req.studioUser.id);
      const canvas = project.canvases.find((item) => item.id === canvasId);
      if (!canvas) throw new Error("画布不存在");
      /* 画布节点本身就是项目资产。自动保存只持久化画布，不再隐式写入全局资产库。 */
      Object.assign(canvas, input, { updatedAt: new Date().toISOString() });
      project.updatedAt = canvas.updatedAt;
      return canvas;
    });
  }

  @Delete(":id/canvases/:canvasId")
  deleteCanvas(@Req() req: AuthRequest, @Param("id") id: string, @Param("canvasId") canvasId: string) {
    return this.store.update((state) => {
      const project = activeProject(state.projects, id, req.studioUser.id);
      if (project.canvases.length <= 1) throw new BadRequestException("项目至少需要保留一张画布");
      const canvasIndex = project.canvases.findIndex((canvas) => canvas.id === canvasId);
      if (canvasIndex < 0) throw new BadRequestException("画布不存在");
      const [deletedCanvas] = project.canvases.splice(canvasIndex, 1);
      project.updatedAt = new Date().toISOString();
      return deletedCanvas;
    });
  }
}
