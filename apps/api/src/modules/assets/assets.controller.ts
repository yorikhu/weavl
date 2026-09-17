import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import type { Readable } from "node:stream";
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

const mediaUploadHeadersSchema = z
  .object({
    name: z.string().min(1).max(720),
    kind: z.enum(["image", "video"]),
    mimeType: z.string().regex(/^(image|video)\/[a-z0-9.+-]+$/i),
    folderId: z.string().nullable().optional(),
    inLibrary: z.enum(["0", "1"]).default("1"),
    contentLength: z.coerce.number().int().nonnegative().optional(),
  })
  .transform((input) => ({ ...input, name: decodeURIComponent(input.name) }));

@Controller("studio/assets")
@UseGuards(SessionGuard)
export class AssetsController {
  constructor(private readonly assets: AssetsService) {}
  /**
   * 读取资产列表。
   *
   * @param req - 已通过认证的请求对象。
   * @param source - 该操作所需的业务参数。
   * @param q - 该操作所需的业务参数。
   * @param trash - 是否查询回收站。
   * @param includeGenerated - 该操作所需的业务参数。
   * @returns 读取资产列表后的结果。
   */
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
  /**
   * 创建资产。
   *
   * @param req - 已通过认证的请求对象。
   * @param body - 尚未校验的请求体。
   * @returns 创建资产后的结果。
   */
  @Post() create(@Req() req: AuthRequest, @Body() body: unknown) {
    const input = parseBody(assetSchema, body);
    return this.assets.create({
      ...input,
      ownerId: req.studioUser.id,
      source: "personal",
      inLibrary: input.inLibrary ?? true,
    });
  }
  /**
   * 流式上传图片或视频资产，绕开 JSON/Data URL 对二进制资源造成的体积限制。
   *
   * @param req - 已通过认证的请求对象，同时也是未缓冲的媒体数据流。
   * @param encodedName - URI 编码后的原始文件名。
   * @param kind - 图片或视频资产类型。
   * @param mimeType - 媒体 MIME 类型。
   * @param folderId - 可选目标文件夹。
   * @param inLibrary - 是否加入全局资产库。
   * @param contentLength - 浏览器提供的可选请求体字节数。
   * @returns 创建完成的资产。
   */
  @Post("upload")
  upload(
    @Req() req: AuthRequest,
    @Headers("x-file-name") encodedName?: string,
    @Headers("x-asset-kind") kind?: string,
    @Headers("content-type") mimeType?: string,
    @Headers("x-folder-id") folderId?: string,
    @Headers("x-in-library") inLibrary?: string,
    @Headers("content-length") contentLength?: string,
  ) {
    const input = parseBody(mediaUploadHeadersSchema, {
      name: encodedName,
      kind,
      mimeType: mimeType?.split(";")[0],
      folderId: folderId || null,
      inLibrary: inLibrary || "1",
      contentLength,
    });
    return this.assets.createMediaUpload({
      ownerId: req.studioUser.id,
      name: input.name,
      kind: input.kind,
      mimeType: input.mimeType,
      folderId: input.folderId,
      inLibrary: input.inLibrary === "1",
      contentLength: input.contentLength,
      stream: req as Readable,
    });
  }

  /**
   * 下载当前用户拥有的资产最新版本。
   *
   * @param req - 已通过认证的请求对象。
   * @param response - 用于设置下载响应头的响应对象。
   * @param id - 资产标识。
   * @returns 由 Nest 流式写出的资产文件。
   */
  @Get(":id/download")
  async download(@Req() req: AuthRequest, @Res({ passthrough: true }) response: Response, @Param("id") id: string) {
    const file = await this.assets.download(id, req.studioUser.id);
    response.setHeader("Content-Type", file.mimeType);
    response.setHeader("Content-Length", String(file.data.length));
    response.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`);
    return new StreamableFile(file.data);
  }
  /**
   * 更新资产。
   *
   * @param req - 已通过认证的请求对象。
   * @param id - 资源标识。
   * @param body - 尚未校验的请求体。
   * @returns 更新资产后的结果。
   */
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
  /**
   * 删除资产。
   *
   * @param req - 已通过认证的请求对象。
   * @param id - 资源标识。
   * @returns 删除资产后的结果。
   */
  @Delete(":id") remove(@Req() req: AuthRequest, @Param("id") id: string) {
    return this.assets.softDelete(id, req.studioUser.id);
  }
  /**
   * 恢复资产。
   *
   * @param req - 已通过认证的请求对象。
   * @param id - 资源标识。
   * @returns 恢复资产后的结果。
   */
  @Post(":id/restore") restore(@Req() req: AuthRequest, @Param("id") id: string) {
    return this.assets.restore(id, req.studioUser.id);
  }
}

@Controller("studio/folders")
@UseGuards(SessionGuard)
export class FoldersController {
  constructor(private readonly assets: AssetsService) {}
  /**
   * 读取资产文件夹列表。
   *
   * @param req - 已通过认证的请求对象。
   * @returns 读取资产文件夹列表后的结果。
   */
  @Get() list(@Req() req: AuthRequest) {
    return this.assets.listFolders(req.studioUser.id);
  }
  /**
   * 创建资产文件夹。
   *
   * @param req - 已通过认证的请求对象。
   * @param body - 尚未校验的请求体。
   * @returns 创建资产文件夹后的结果。
   */
  @Post() create(@Req() req: AuthRequest, @Body() body: unknown) {
    const input = parseBody(
      z.object({ name: z.string().trim().min(1).max(80), parentId: z.string().nullable().optional() }),
      body,
    );
    return this.assets.createFolder(req.studioUser.id, input.name, input.parentId);
  }
  /**
   * 更新资产文件夹。
   *
   * @param req - 已通过认证的请求对象。
   * @param id - 资源标识。
   * @param body - 尚未校验的请求体。
   * @returns 更新资产文件夹后的结果。
   */
  @Patch(":id") update(@Req() req: AuthRequest, @Param("id") id: string, @Body() body: unknown) {
    const input = parseBody(z.object({ name: z.string().trim().min(1).max(80) }), body);
    return this.assets.renameFolder(id, req.studioUser.id, input.name);
  }
  /**
   * 删除资产文件夹。
   *
   * @param req - 已通过认证的请求对象。
   * @param id - 资源标识。
   * @returns 删除资产文件夹后的结果。
   */
  @Delete(":id") remove(@Req() req: AuthRequest, @Param("id") id: string) {
    return this.assets.deleteFolder(id, req.studioUser.id);
  }
}
