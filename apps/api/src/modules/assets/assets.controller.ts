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
