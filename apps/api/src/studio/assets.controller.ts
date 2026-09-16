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
import type { Asset, AssetSource } from "@weavl/shared";
import { AuthRequest, owned, parseBody, SessionGuard } from "./http";
import { newId, StudioStore } from "./store";

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
  constructor(private readonly store: StudioStore) {}

  @Get()
  list(
    @Req() req: AuthRequest,
    @Query("source") source?: AssetSource,
    @Query("q") q?: string,
    @Query("trash") trash?: string,
    @Query("includeGenerated") includeGenerated?: string,
  ) {
    return this.store
      .read()
      .assets.filter(
        (asset) =>
          asset.ownerId === req.studioUser.id &&
          (includeGenerated === "1" || asset.inLibrary !== false) &&
          Boolean(asset.deletedAt) === (trash === "1") &&
          (!source || asset.source === source) &&
          (!q || asset.name.toLowerCase().includes(q.toLowerCase())),
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  @Post()
  create(@Req() req: AuthRequest, @Body() body: unknown): Asset {
    const input = parseBody(assetSchema, body);
    if (input.folderId) owned(this.store.read().folders, input.folderId, req.studioUser.id);
    return this.store.createAsset({
      ...input,
      ownerId: req.studioUser.id,
      source: "personal",
      inLibrary: input.inLibrary ?? true,
    });
  }

  @Patch(":id")
  update(@Req() req: AuthRequest, @Param("id") id: string, @Body() body: unknown) {
    const input = parseBody(
      z.object({
        name: z.string().trim().min(1).max(180).optional(),
        folderId: z.string().nullable().optional(),
        content: z.string().max(8_000_000).optional(),
        inLibrary: z.boolean().optional(),
      }),
      body,
    );
    if (input.folderId) owned(this.store.read().folders, input.folderId, req.studioUser.id);
    return this.store.update((state) => {
      const asset = owned(state.assets, id, req.studioUser.id);
      if (input.name) asset.name = input.name;
      if (input.folderId !== undefined) asset.folderId = input.folderId;
      if (input.inLibrary !== undefined) asset.inLibrary = input.inLibrary;
      if (input.content !== undefined)
        asset.versions.push({
          id: newId("version"),
          name: asset.name,
          mimeType: asset.versions.at(-1)?.mimeType || "text/plain",
          size: input.content.length,
          content: input.content,
          createdAt: new Date().toISOString(),
        });
      asset.updatedAt = new Date().toISOString();
      return asset;
    });
  }

  @Delete(":id")
  remove(@Req() req: AuthRequest, @Param("id") id: string) {
    return this.store.update((state) => {
      const asset = owned(state.assets, id, req.studioUser.id);
      asset.deletedAt = new Date().toISOString();
      return asset;
    });
  }

  @Post(":id/restore")
  restore(@Req() req: AuthRequest, @Param("id") id: string) {
    return this.store.update((state) => {
      const asset = owned(state.assets, id, req.studioUser.id);
      delete asset.deletedAt;
      return asset;
    });
  }
}

@Controller("studio/folders")
@UseGuards(SessionGuard)
export class FoldersController {
  constructor(private readonly store: StudioStore) {}
  @Get() list(@Req() req: AuthRequest) {
    return this.store.read().folders.filter((folder) => folder.ownerId === req.studioUser.id);
  }
  @Post() create(@Req() req: AuthRequest, @Body() body: unknown) {
    const input = parseBody(
      z.object({ name: z.string().trim().min(1).max(80), parentId: z.string().nullable().optional() }),
      body,
    );
    if (input.parentId) owned(this.store.read().folders, input.parentId, req.studioUser.id);
    const folder = {
      id: newId("folder"),
      ownerId: req.studioUser.id,
      parentId: input.parentId || null,
      name: input.name,
      createdAt: new Date().toISOString(),
    };
    this.store.update((state) => state.folders.push(folder));
    return folder;
  }
  @Patch(":id") update(@Req() req: AuthRequest, @Param("id") id: string, @Body() body: unknown) {
    const { name } = parseBody(z.object({ name: z.string().trim().min(1).max(80) }), body);
    return this.store.update((state) => {
      const folder = owned(state.folders, id, req.studioUser.id);
      folder.name = name;
      return folder;
    });
  }
  @Delete(":id") remove(@Req() req: AuthRequest, @Param("id") id: string) {
    return this.store.update((state) => {
      owned(state.folders, id, req.studioUser.id);
      if (state.folders.some((folder) => folder.parentId === id)) throw new BadRequestException("请先清空子文件夹");
      state.assets
        .filter((asset) => asset.folderId === id)
        .forEach((asset) => {
          asset.folderId = null;
        });
      state.folders = state.folders.filter((folder) => folder.id !== id);
      return { ok: true };
    });
  }
}
