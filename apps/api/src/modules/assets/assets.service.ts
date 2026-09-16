import { BadRequestException, Injectable } from "@nestjs/common";
import type { Asset as StudioAsset, AssetKind, AssetSource, Folder } from "@weavl/shared";
import { newId } from "../../common/id";
import type { Asset, AssetVersion } from "@prisma/client";
import { PrismaService } from "../../infrastructure/database/prisma.service";
import { ObjectStorageService } from "../../infrastructure/storage/object-storage.service";

type AssetWithVersions = Asset & { versions: AssetVersion[] };

@Injectable()
export class AssetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ObjectStorageService,
  ) {}

  async list(
    ownerId: string,
    filters: { source?: AssetSource; q?: string; trash: boolean; includeGenerated: boolean },
  ) {
    const rows = await this.prisma.asset.findMany({
      where: {
        ownerId,
        deletedAt: filters.trash ? { not: null } : null,
        inLibrary: filters.includeGenerated ? undefined : true,
        source: filters.source,
        name: filters.q ? { contains: filters.q, mode: "insensitive" } : undefined,
      },
      include: { versions: { orderBy: { createdAt: "asc" } } },
      orderBy: { updatedAt: "desc" },
    });
    return Promise.all(rows.map((x) => this.hydrate(x)));
  }

  async findOwned(id: string, ownerId: string, includeDeleted = true) {
    const asset = await this.prisma.asset.findFirst({
      where: { id, ownerId, deletedAt: includeDeleted ? undefined : null },
    });
    if (!asset) throw new BadRequestException("资产不存在或无权访问");
    return asset;
  }

  async getManyOwned(ids: string[], ownerId: string, includeDeleted = false) {
    if (!ids.length) return [];
    const rows = await this.prisma.asset.findMany({
      where: { id: { in: ids }, ownerId, deletedAt: includeDeleted ? undefined : null },
      include: { versions: { orderBy: { createdAt: "asc" } } },
    });
    const byId = new Map(rows.map((x) => [x.id, x]));
    return Promise.all(
      ids.map((id) => {
        const row = byId.get(id);
        if (!row) throw new BadRequestException("资产不存在或无权访问");
        return this.hydrate(row);
      }),
    );
  }

  async create(input: {
    ownerId: string;
    name: string;
    kind: AssetKind;
    content: string;
    mimeType?: string;
    folderId?: string | null;
    source: AssetSource;
    sourceId?: string;
    inLibrary?: boolean;
  }): Promise<StudioAsset> {
    if (input.folderId) await this.assertFolder(input.folderId, input.ownerId);
    const stored = await this.storage.persist(input.content, input.mimeType, `assets/${input.ownerId}`);
    const stamp = new Date();
    const asset = await this.prisma.asset.create({
      data: {
        id: newId("asset"),
        ownerId: input.ownerId,
        folderId: input.folderId || null,
        name: input.name,
        kind: input.kind,
        source: input.source,
        sourceId: input.sourceId,
        inLibrary: input.inLibrary ?? true,
        createdAt: stamp,
        updatedAt: stamp,
        versions: {
          create: {
            id: newId("version"),
            name: input.name,
            mimeType: stored.mimeType,
            size: BigInt(stored.size),
            content: stored.content,
            storageKey: stored.storageKey,
            createdAt: stamp,
          },
        },
      },
      include: { versions: true },
    });
    return this.hydrate(asset);
  }

  async get(id: string, ownerId: string) {
    const asset = await this.prisma.asset.findFirst({
      where: { id, ownerId },
      include: { versions: { orderBy: { createdAt: "asc" } } },
    });
    if (!asset) throw new BadRequestException("资产不存在或无权访问");
    return this.hydrate(asset);
  }

  async update(
    id: string,
    ownerId: string,
    input: { name?: string; folderId?: string | null; content?: string; inLibrary?: boolean },
  ) {
    const asset = await this.prisma.asset.findFirst({
      where: { id, ownerId },
      include: { versions: { orderBy: { createdAt: "desc" }, take: 1 } },
    });
    if (!asset) throw new BadRequestException("资产不存在或无权访问");
    if (input.folderId) await this.assertFolder(input.folderId, ownerId);
    let stored: Awaited<ReturnType<ObjectStorageService["persist"]>> | undefined;
    if (input.content !== undefined)
      stored = await this.storage.persist(input.content, asset.versions[0]?.mimeType, `assets/${ownerId}`);
    await this.prisma.asset.update({
      where: { id },
      data: {
        name: input.name,
        folderId: input.folderId,
        inLibrary: input.inLibrary,
        updatedAt: new Date(),
        versions: stored
          ? {
              create: {
                id: newId("version"),
                name: input.name || asset.name,
                mimeType: stored.mimeType,
                size: BigInt(stored.size),
                content: stored.content,
                storageKey: stored.storageKey,
              },
            }
          : undefined,
      },
    });
    return this.get(id, ownerId);
  }

  async softDelete(id: string, ownerId: string) {
    await this.findOwned(id, ownerId);
    await this.prisma.asset.update({ where: { id }, data: { deletedAt: new Date(), updatedAt: new Date() } });
    return this.get(id, ownerId);
  }
  async restore(id: string, ownerId: string) {
    await this.findOwned(id, ownerId);
    await this.prisma.asset.update({ where: { id }, data: { deletedAt: null, updatedAt: new Date() } });
    return this.get(id, ownerId);
  }

  async listFolders(ownerId: string): Promise<Folder[]> {
    return (await this.prisma.assetFolder.findMany({ where: { ownerId }, orderBy: { createdAt: "asc" } })).map((x) => ({
      id: x.id,
      ownerId: x.ownerId,
      parentId: x.parentId,
      name: x.name,
      createdAt: x.createdAt.toISOString(),
    }));
  }
  async createFolder(ownerId: string, name: string, parentId?: string | null) {
    if (parentId) await this.assertFolder(parentId, ownerId);
    const x = await this.prisma.assetFolder.create({
      data: { id: newId("folder"), ownerId, parentId: parentId || null, name },
    });
    return { id: x.id, ownerId: x.ownerId, parentId: x.parentId, name: x.name, createdAt: x.createdAt.toISOString() };
  }
  async renameFolder(id: string, ownerId: string, name: string) {
    await this.assertFolder(id, ownerId);
    const x = await this.prisma.assetFolder.update({ where: { id }, data: { name } });
    return { id: x.id, ownerId: x.ownerId, parentId: x.parentId, name: x.name, createdAt: x.createdAt.toISOString() };
  }
  async deleteFolder(id: string, ownerId: string) {
    await this.assertFolder(id, ownerId);
    if (await this.prisma.assetFolder.findFirst({ where: { parentId: id }, select: { id: true } }))
      throw new BadRequestException("请先清空子文件夹");
    await this.prisma.$transaction([
      this.prisma.asset.updateMany({ where: { folderId: id }, data: { folderId: null } }),
      this.prisma.assetFolder.delete({ where: { id } }),
    ]);
    return { ok: true };
  }

  private async assertFolder(id: string, ownerId: string) {
    if (!(await this.prisma.assetFolder.findFirst({ where: { id, ownerId }, select: { id: true } })))
      throw new BadRequestException("文件夹不存在或无权访问");
  }
  private async hydrate(row: AssetWithVersions): Promise<StudioAsset> {
    return {
      id: row.id,
      ownerId: row.ownerId,
      folderId: row.folderId,
      name: row.name,
      kind: row.kind as AssetKind,
      source: row.source as AssetSource,
      sourceId: row.sourceId || undefined,
      inLibrary: row.inLibrary,
      versions: await Promise.all(
        row.versions.map(async (version) => ({
          id: version.id,
          name: version.name,
          mimeType: version.mimeType,
          size: Number(version.size),
          content: await this.storage.resolve(version.content, version.storageKey),
          createdAt: version.createdAt.toISOString(),
        })),
      ),
      deletedAt: row.deletedAt?.toISOString(),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
