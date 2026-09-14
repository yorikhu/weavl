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
      name: "主画布",
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
    const input = parseBody(z.object({ name: z.string().trim().min(1).max(80).default("新画布") }), body);
    return this.store.update((state) => {
      const project = activeProject(state.projects, id, req.studioUser.id);
      const canvas: CanvasDocument = {
        id: newId("canvas"),
        name: input.name,
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
      if (input.nodes) {
        input.nodes.forEach((rawNode) => {
          if (!rawNode || typeof rawNode !== "object") return;
          const node = rawNode as { id?: string; type?: string; data?: Record<string, unknown> };
          const data = node.data;
          if (!node.id || !data) return;
          const content =
            node.type === "text"
              ? String(data.text || "")
              : node.type === "image" || node.type === "video"
                ? String(data.url || "")
                : "";
          const sourceId = `${project.id}:${canvas.id}:${node.id}`;
          const ref = data.assetRef as { assetId?: string; versionId?: string } | undefined;
          if (ref?.assetId) {
            const linked = owned(state.assets, ref.assetId, req.studioUser.id);
            if (
              linked.source === "canvas" &&
              linked.sourceId === sourceId &&
              content.trim() &&
              linked.versions.at(-1)?.content !== content
            ) {
              const timestamp = new Date().toISOString();
              linked.versions.push({
                id: newId("version"),
                name: linked.name,
                mimeType: node.type === "text" ? "text/plain" : "application/octet-stream",
                size: content.length,
                content,
                createdAt: timestamp,
              });
              linked.updatedAt = timestamp;
              data.assetRef = { assetId: linked.id, versionId: linked.versions.at(-1)!.id };
            }
            return;
          }
          if (!content.trim()) return;
          const existing = state.assets.find(
            (asset) => asset.ownerId === req.studioUser.id && asset.source === "canvas" && asset.sourceId === sourceId,
          );
          const timestamp = new Date().toISOString();
          if (existing) {
            if (existing.versions.at(-1)?.content !== content) {
              existing.versions.push({
                id: newId("version"),
                name: existing.name,
                mimeType: node.type === "text" ? "text/plain" : "application/octet-stream",
                size: content.length,
                content,
                createdAt: timestamp,
              });
              existing.updatedAt = timestamp;
            }
            data.assetRef = { assetId: existing.id, versionId: existing.versions.at(-1)!.id };
            data.source = "canvas";
          } else {
            const name = String(data.title || "画布内容");
            const version = {
              id: newId("version"),
              name,
              mimeType: node.type === "text" ? "text/plain" : "application/octet-stream",
              size: content.length,
              content,
              createdAt: timestamp,
            };
            const asset = {
              id: newId("asset"),
              ownerId: req.studioUser.id,
              folderId: null,
              name,
              kind:
                node.type === "image"
                  ? ("image" as const)
                  : node.type === "video"
                    ? ("video" as const)
                    : ("text" as const),
              source: "canvas" as const,
              sourceId,
              versions: [version],
              createdAt: timestamp,
              updatedAt: timestamp,
            };
            state.assets.push(asset);
            data.assetRef = { assetId: asset.id, versionId: version.id };
            data.source = "canvas";
          }
        });
      }
      Object.assign(canvas, input, { updatedAt: new Date().toISOString() });
      project.updatedAt = canvas.updatedAt;
      return canvas;
    });
  }
}
