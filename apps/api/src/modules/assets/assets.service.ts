import { BadRequestException, Injectable } from "@nestjs/common";
import type { Asset as StudioAsset, AssetKind, AssetSource, Folder } from "@weavl/shared";
import { newId } from "../../common/id";
import type { Asset, AssetVersion } from "@prisma/client";
import type { Readable } from "node:stream";
import { PrismaService } from "../../infrastructure/database/prisma.service";
import { ObjectStorageService } from "../../infrastructure/storage/object-storage.service";

type AssetWithVersions = Asset & { versions: AssetVersion[] };

@Injectable()
export class AssetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ObjectStorageService,
  ) {}

  /**
   * 读取资产列表。
   *
   * @param ownerId - 当前用户 ID。
   * @param filters - 列表过滤条件。
   * @returns 读取资产列表后的结果。
   */
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

  /**
   * findOwned 资产。
   *
   * @param id - 资源标识。
   * @param ownerId - 当前用户 ID。
   * @param includeDeleted - 是否包含回收站数据。
   * @returns findOwned 资产后的结果。
   */
  async findOwned(id: string, ownerId: string, includeDeleted = true) {
    const asset = await this.prisma.asset.findFirst({
      where: { id, ownerId, deletedAt: includeDeleted ? undefined : null },
    });
    if (!asset) throw new BadRequestException("资产不存在或无权访问");
    return asset;
  }

  /**
   * 按输入 ID 顺序读取并解析一组用户资产。
   * 任意资产缺失或不属于当前用户时整体失败，避免任务结果被部分泄露。
   *
   * @param ids - 需要读取的资产 ID，返回顺序与其一致。
   * @param ownerId - 当前用户 ID。
   * @param includeDeleted - 是否允许读取已进入回收站的资产。
   * @returns 解析对象存储地址后的资产列表。
   * @throws {BadRequestException} 任意资产缺失或不属于当前用户时抛出。
   */
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

  /**
   * 按给定顺序读取用户图片资产，转换为供应商适配器可消费的 Base64 参考图。
   *
   * @param ids - 画布节点引用的图片资产 ID。
   * @param ownerId - 当前用户 ID。
   * @returns 已完成权限校验的参考图片数据。
   * @throws {BadRequestException} 资产缺失、已删除、类型错误或没有版本时抛出。
   */
  async readImageInputs(ids: string[], ownerId: string) {
    const orderedIds = [...new Set(ids)];
    if (!orderedIds.length) return [];
    const rows = await this.prisma.asset.findMany({
      where: { id: { in: orderedIds }, ownerId, deletedAt: null },
      include: { versions: { orderBy: { createdAt: "desc" }, take: 1 } },
    });
    const byId = new Map(rows.map((asset) => [asset.id, asset]));
    return Promise.all(
      orderedIds.map(async (id) => {
        const asset = byId.get(id);
        const version = asset?.versions[0];
        if (!asset || asset.kind !== "image" || !version) {
          throw new BadRequestException("参考图片不存在、已删除或无权访问");
        }
        const media = await this.storage.read(version.content, version.storageKey, version.mimeType);
        return { assetId: id, data: media.data.toString("base64"), mimeType: media.mimeType, size: media.data.length };
      }),
    );
  }

  /**
   * 创建资产及首个版本。
   * copyRemote 用于生成产物，开启后会先把供应商临时地址复制到平台对象存储。
   *
   * @param input - 资产归属、名称、内容、来源和持久化策略。
   * @returns 已解析内容地址的资产对象。
   * @throws {BadRequestException} 指定文件夹不存在或不属于当前用户时抛出。
   */
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
    copyRemote?: boolean;
  }): Promise<StudioAsset> {
    if (input.folderId) await this.assertFolder(input.folderId, input.ownerId);
    const stored = input.copyRemote
      ? await this.storage.persistRemote(
          input.content,
          input.mimeType || "application/octet-stream",
          `assets/${input.ownerId}`,
        )
      : await this.storage.persist(input.content, input.mimeType, `assets/${input.ownerId}`);
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

  /**
   * 接收图片或视频请求流并创建资产。文件全程流向对象存储，不设置应用层体积上限。
   *
   * @param input - 上传元数据、用户归属和原始请求流。
   * @returns 已创建并解析访问地址的资产。
   * @throws {BadRequestException} 指定文件夹不存在或数据库写入失败时抛出。
   */
  async createMediaUpload(input: {
    ownerId: string;
    name: string;
    kind: "image" | "video";
    mimeType: string;
    contentLength?: number;
    folderId?: string | null;
    inLibrary: boolean;
    stream: Readable;
  }): Promise<StudioAsset> {
    if (input.folderId) await this.assertFolder(input.folderId, input.ownerId);
    const stored = await this.storage.persistStream(
      input.stream,
      input.mimeType,
      input.contentLength,
      `assets/${input.ownerId}`,
    );
    const stamp = new Date();
    try {
      const asset = await this.prisma.asset.create({
        data: {
          id: newId("asset"),
          ownerId: input.ownerId,
          folderId: input.folderId || null,
          name: input.name,
          kind: input.kind,
          source: "personal",
          inLibrary: input.inLibrary,
          createdAt: stamp,
          updatedAt: stamp,
          versions: {
            create: {
              id: newId("version"),
              name: input.name,
              mimeType: stored.mimeType,
              size: BigInt(stored.size),
              storageKey: stored.storageKey,
              createdAt: stamp,
            },
          },
        },
        include: { versions: true },
      });
      return this.hydrate(asset);
    } catch (error) {
      await this.storage.remove(stored.storageKey).catch(() => undefined);
      throw error;
    }
  }

  /**
   * 读取资产详情。
   *
   * @param id - 资源标识。
   * @param ownerId - 当前用户 ID。
   * @returns 读取资产详情后的结果。
   */
  async get(id: string, ownerId: string) {
    const asset = await this.prisma.asset.findFirst({
      where: { id, ownerId },
      include: { versions: { orderBy: { createdAt: "asc" } } },
    });
    if (!asset) throw new BadRequestException("资产不存在或无权访问");
    return this.hydrate(asset);
  }

  /**
   * 读取用户资产的最新版本用于下载。
   *
   * @param id - 资产标识。
   * @param ownerId - 当前用户 ID。
   * @returns 文件名、MIME 类型和原始文件字节。
   * @throws {BadRequestException} 资产不存在、已删除或没有可下载版本时抛出。
   */
  async download(id: string, ownerId: string) {
    const asset = await this.prisma.asset.findFirst({
      where: { id, ownerId, deletedAt: null },
      include: { versions: { orderBy: { createdAt: "desc" }, take: 1 } },
    });
    const version = asset?.versions[0];
    if (!asset || !version) throw new BadRequestException("资产不存在或没有可下载版本");
    const file = await this.storage.read(version.content, version.storageKey, version.mimeType);
    return { name: version.name || asset.name, mimeType: file.mimeType, data: file.data };
  }

  /**
   * 更新资产。
   *
   * @param id - 资源标识。
   * @param ownerId - 当前用户 ID。
   * @param input - 业务输入数据。
   * @returns 更新资产后的结果。
   */
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

  /**
   * softDelete 资产。
   *
   * @param id - 资源标识。
   * @param ownerId - 当前用户 ID。
   * @returns softDelete 资产后的结果。
   */
  async softDelete(id: string, ownerId: string) {
    await this.findOwned(id, ownerId);
    await this.prisma.asset.update({ where: { id }, data: { deletedAt: new Date(), updatedAt: new Date() } });
    return this.get(id, ownerId);
  }
  /**
   * 恢复资产。
   *
   * @param id - 资源标识。
   * @param ownerId - 当前用户 ID。
   * @returns 恢复资产后的结果。
   */
  async restore(id: string, ownerId: string) {
    await this.findOwned(id, ownerId);
    await this.prisma.asset.update({ where: { id }, data: { deletedAt: null, updatedAt: new Date() } });
    return this.get(id, ownerId);
  }

  /**
   * listFolders 资产。
   *
   * @param ownerId - 当前用户 ID。
   * @returns listFolders 资产后的结果。
   */
  async listFolders(ownerId: string): Promise<Folder[]> {
    return (await this.prisma.assetFolder.findMany({ where: { ownerId }, orderBy: { createdAt: "asc" } })).map((x) => ({
      id: x.id,
      ownerId: x.ownerId,
      parentId: x.parentId,
      name: x.name,
      createdAt: x.createdAt.toISOString(),
    }));
  }
  /**
   * 创建文件夹。
   *
   * @param ownerId - 当前用户 ID。
   * @param name - 该操作所需的业务参数。
   * @param parentId - 该操作所需的业务参数。
   * @returns 创建文件夹后的结果。
   */
  async createFolder(ownerId: string, name: string, parentId?: string | null) {
    if (parentId) await this.assertFolder(parentId, ownerId);
    const x = await this.prisma.assetFolder.create({
      data: { id: newId("folder"), ownerId, parentId: parentId || null, name },
    });
    return { id: x.id, ownerId: x.ownerId, parentId: x.parentId, name: x.name, createdAt: x.createdAt.toISOString() };
  }
  /**
   * 重命名文件夹。
   *
   * @param id - 资源标识。
   * @param ownerId - 当前用户 ID。
   * @param name - 该操作所需的业务参数。
   * @returns 重命名文件夹后的结果。
   */
  async renameFolder(id: string, ownerId: string, name: string) {
    await this.assertFolder(id, ownerId);
    const x = await this.prisma.assetFolder.update({ where: { id }, data: { name } });
    return { id: x.id, ownerId: x.ownerId, parentId: x.parentId, name: x.name, createdAt: x.createdAt.toISOString() };
  }
  /**
   * 删除文件夹。
   *
   * @param id - 资源标识。
   * @param ownerId - 当前用户 ID。
   * @returns 删除文件夹后的结果。
   */
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
