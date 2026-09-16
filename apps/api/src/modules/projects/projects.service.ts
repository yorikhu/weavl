import { BadRequestException, Injectable } from "@nestjs/common";
import type { CanvasDocument, CanvasProject, ProjectFolder } from "@weavl/shared";
import { newId } from "../../common/id";
import type { Canvas, Prisma, Project } from "@prisma/client";
import { PrismaService } from "../../infrastructure/database/prisma.service";
import { ObjectStorageService } from "../../infrastructure/storage/object-storage.service";
import { AssetsService } from "../assets/assets.service";

type ProjectWithCanvases = Project & { canvases: Canvas[] };
@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ObjectStorageService,
    private readonly assets: AssetsService,
  ) {}
  async list(ownerId: string, trash: boolean) {
    const rows = await this.prisma.project.findMany({
      where: { ownerId, deletedAt: trash ? { not: null } : null },
      include: { canvases: { orderBy: { position: "asc" } } },
      orderBy: trash ? { deletedAt: "desc" } : { updatedAt: "desc" },
    });
    return Promise.all(rows.map((x) => this.hydrate(x)));
  }
  async get(id: string, ownerId: string, includeDeleted = false) {
    const project = await this.prisma.project.findFirst({
      where: { id, ownerId, deletedAt: includeDeleted ? undefined : null },
      include: { canvases: { orderBy: { position: "asc" } } },
    });
    if (!project) throw new BadRequestException("项目不存在或无权访问");
    return this.hydrate(project);
  }
  async create(ownerId: string, input: { name: string; assetIds: string[]; folderId?: string | null }) {
    if (input.folderId) await this.assertFolder(input.folderId, ownerId);
    const assets = await this.assets.getManyOwned(input.assetIds, ownerId);
    const nodes = assets.map((asset, index) => {
      const version = asset.versions.at(-1)!;
      return {
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
                url: version.content,
                assetRef: { assetId: asset.id, versionId: version.id },
                source: asset.source,
              }
            : {
                nodeKind: "text",
                title: asset.name,
                text: version.content,
                assetRef: { assetId: asset.id, versionId: version.id },
                source: asset.source,
              },
      };
    });
    const project = await this.prisma.project.create({
      data: {
        id: newId("project"),
        ownerId,
        folderId: input.folderId || null,
        name: input.name,
        canvases: {
          create: {
            id: newId("canvas"),
            name: "画布 1",
            nodes: nodes as Prisma.InputJsonValue,
            edges: [],
            viewport: { x: 0, y: 0, zoom: 1 },
            position: 0,
          },
        },
      },
      include: { canvases: true },
    });
    return this.hydrate(project);
  }
  async update(
    id: string,
    ownerId: string,
    input: { name?: string; folderId?: string | null; coverUrl?: string | null },
  ) {
    const project = await this.findRow(id, ownerId);
    if (input.folderId) await this.assertFolder(input.folderId, ownerId);
    let coverUrl: string | null | undefined, coverStorageKey: string | null | undefined;
    if (input.coverUrl !== undefined) {
      if (input.coverUrl === null) {
        coverUrl = null;
        coverStorageKey = null;
      } else {
        const stored = await this.storage.persist(input.coverUrl, "image/webp", `covers/${ownerId}`);
        coverUrl = stored.content;
        coverStorageKey = stored.storageKey;
      }
    }
    await this.prisma.project.update({
      where: { id },
      data: { name: input.name, folderId: input.folderId, coverUrl, coverStorageKey, updatedAt: new Date() },
    });
    if (input.coverUrl !== undefined && project.coverStorageKey && project.coverStorageKey !== coverStorageKey)
      await this.storage.remove(project.coverStorageKey);
    return this.get(id, ownerId);
  }
  async duplicate(id: string, ownerId: string) {
    const source = await this.get(id, ownerId);
    const dbSource = await this.findRow(id, ownerId);
    const copyId = newId("project");
    await this.prisma.$transaction(async (tx) => {
      await tx.project.create({
        data: {
          id: copyId,
          ownerId,
          folderId: source.folderId || null,
          name: `${source.name} 副本`,
          coverUrl: dbSource.coverUrl,
          coverStorageKey: dbSource.coverStorageKey,
        },
      });
      for (const [position, canvas] of source.canvases.entries()) {
        const ids = new Map<string, string>();
        const nodes = structuredClone(canvas.nodes).map((raw) => {
          if (!raw || typeof raw !== "object") return raw;
          const node = raw as { id?: string };
          if (!node.id) return node;
          const next = newId("node");
          ids.set(node.id, next);
          node.id = next;
          return node;
        });
        const edges = structuredClone(canvas.edges).map((raw) => {
          if (!raw || typeof raw !== "object") return raw;
          const edge = raw as { id?: string; source?: string; target?: string };
          if (edge.id) edge.id = newId("edge");
          if (edge.source) edge.source = ids.get(edge.source) || edge.source;
          if (edge.target) edge.target = ids.get(edge.target) || edge.target;
          return edge;
        });
        await tx.canvas.create({
          data: {
            id: newId("canvas"),
            projectId: copyId,
            name: canvas.name,
            nodes: nodes as Prisma.InputJsonValue,
            edges: edges as Prisma.InputJsonValue,
            viewport: canvas.viewport,
            position,
          },
        });
      }
    });
    return this.get(copyId, ownerId);
  }
  async softDelete(id: string, ownerId: string) {
    await this.findRow(id, ownerId);
    await this.prisma.project.update({ where: { id }, data: { deletedAt: new Date(), updatedAt: new Date() } });
    return this.get(id, ownerId, true);
  }
  async restore(id: string, ownerId: string) {
    const project = await this.findRow(id, ownerId, true);
    if (!project.deletedAt) throw new BadRequestException("项目不在回收站");
    await this.prisma.project.update({ where: { id }, data: { deletedAt: null, updatedAt: new Date() } });
    return this.get(id, ownerId);
  }
  async permanentDelete(id: string, ownerId: string) {
    const project = await this.findRow(id, ownerId, true);
    if (!project.deletedAt) throw new BadRequestException("请先将项目移入回收站");
    await this.prisma.project.delete({ where: { id } });
    return { ok: true };
  }
  async addCanvas(projectId: string, ownerId: string, name?: string) {
    await this.findRow(projectId, ownerId);
    const count = await this.prisma.canvas.count({ where: { projectId } });
    const canvas = await this.prisma.canvas.create({
      data: {
        id: newId("canvas"),
        projectId,
        name: name || `画布 ${count + 1}`,
        nodes: [],
        edges: [],
        viewport: { x: 0, y: 0, zoom: 1 },
        position: count,
      },
    });
    await this.touch(projectId);
    return this.mapCanvas(canvas);
  }
  async saveCanvas(
    projectId: string,
    canvasId: string,
    ownerId: string,
    input: Partial<Pick<CanvasDocument, "name" | "nodes" | "edges" | "viewport">>,
  ) {
    await this.findRow(projectId, ownerId);
    const exists = await this.prisma.canvas.findFirst({ where: { id: canvasId, projectId } });
    if (!exists) throw new BadRequestException("画布不存在");
    const canvas = await this.prisma.canvas.update({
      where: { id: canvasId },
      data: {
        name: input.name,
        nodes: input.nodes as Prisma.InputJsonValue | undefined,
        edges: input.edges as Prisma.InputJsonValue | undefined,
        viewport: input.viewport,
        version: { increment: 1 },
        updatedAt: new Date(),
      },
    });
    await this.touch(projectId);
    return this.mapCanvas(canvas);
  }
  async deleteCanvas(projectId: string, canvasId: string, ownerId: string) {
    await this.findRow(projectId, ownerId);
    if ((await this.prisma.canvas.count({ where: { projectId } })) <= 1)
      throw new BadRequestException("项目至少需要保留一张画布");
    const canvas = await this.prisma.canvas.findFirst({ where: { id: canvasId, projectId } });
    if (!canvas) throw new BadRequestException("画布不存在");
    await this.prisma.canvas.delete({ where: { id: canvasId } });
    await this.touch(projectId);
    return this.mapCanvas(canvas);
  }
  async listFolders(ownerId: string): Promise<ProjectFolder[]> {
    return (await this.prisma.projectFolder.findMany({ where: { ownerId }, orderBy: { createdAt: "asc" } })).map(
      (x) => ({ id: x.id, ownerId: x.ownerId, name: x.name, createdAt: x.createdAt.toISOString() }),
    );
  }
  async createFolder(ownerId: string, name: string) {
    const x = await this.prisma.projectFolder.create({ data: { id: newId("project_folder"), ownerId, name } });
    return { id: x.id, ownerId: x.ownerId, name: x.name, createdAt: x.createdAt.toISOString() };
  }
  async renameFolder(id: string, ownerId: string, name: string) {
    await this.assertFolder(id, ownerId);
    const x = await this.prisma.projectFolder.update({ where: { id }, data: { name } });
    return { id: x.id, ownerId: x.ownerId, name: x.name, createdAt: x.createdAt.toISOString() };
  }
  async deleteFolder(id: string, ownerId: string) {
    await this.assertFolder(id, ownerId);
    await this.prisma.$transaction([
      this.prisma.project.updateMany({ where: { folderId: id }, data: { folderId: null } }),
      this.prisma.projectFolder.delete({ where: { id } }),
    ]);
    return { ok: true };
  }
  private async findRow(id: string, ownerId: string, includeDeleted = false) {
    const project = await this.prisma.project.findFirst({
      where: { id, ownerId, deletedAt: includeDeleted ? undefined : null },
    });
    if (!project) throw new BadRequestException("项目不存在或无权访问");
    return project;
  }
  private async assertFolder(id: string, ownerId: string) {
    if (!(await this.prisma.projectFolder.findFirst({ where: { id, ownerId }, select: { id: true } })))
      throw new BadRequestException("文件夹不存在或无权访问");
  }
  private touch(id: string) {
    return this.prisma.project.update({ where: { id }, data: { updatedAt: new Date() } });
  }
  private mapCanvas(row: Canvas): CanvasDocument {
    return {
      id: row.id,
      name: row.name,
      nodes: row.nodes as unknown[],
      edges: row.edges as unknown[],
      viewport: row.viewport as CanvasDocument["viewport"],
      updatedAt: row.updatedAt.toISOString(),
    };
  }
  private async hydrate(row: ProjectWithCanvases): Promise<CanvasProject> {
    return {
      id: row.id,
      ownerId: row.ownerId,
      name: row.name,
      folderId: row.folderId,
      coverUrl:
        row.coverUrl || row.coverStorageKey ? await this.storage.resolve(row.coverUrl, row.coverStorageKey) : null,
      deletedAt: row.deletedAt?.toISOString(),
      canvases: row.canvases.map((x) => this.mapCanvas(x)),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
