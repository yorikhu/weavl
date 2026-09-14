import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { AuthRequest, owned, parseBody, SessionGuard } from "./http";
import { newId, StudioStore } from "./store";

const entrySchema = z.object({
  type: z.literal("skill"),
  title: z.string().trim().min(1).max(100),
  description: z.string().trim().min(1).max(300),
  content: z.string().trim().min(1).max(10000),
  inputHint: z.string().max(200).default("文字说明"),
  outputKind: z.enum(["text", "image", "video", "audio", "pdf", "word", "ppt", "file"]).default("text"),
});

@Controller("studio/market")
@UseGuards(SessionGuard)
export class MarketController {
  constructor(private readonly store: StudioStore) {}
  @Get() list(@Req() req: AuthRequest) {
    return this.store
      .read()
      .market.filter((entry) => entry.ownerId === req.studioUser.id || entry.visibility === "official")
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  @Post() create(@Req() req: AuthRequest, @Body() body: unknown) {
    const input = parseBody(entrySchema, body);
    const stamp = new Date().toISOString();
    const entry = {
      ...input,
      id: newId(input.type),
      ownerId: req.studioUser.id,
      visibility: "private" as const,
      version: 1,
      createdAt: stamp,
      updatedAt: stamp,
    };
    this.store.update((state) => state.market.push(entry));
    return entry;
  }
  @Patch(":id") update(@Req() req: AuthRequest, @Param("id") id: string, @Body() body: unknown) {
    const input = parseBody(entrySchema.partial(), body);
    return this.store.update((state) => {
      const entry = owned(state.market, id, req.studioUser.id);
      Object.assign(entry, input);
      entry.version += 1;
      entry.updatedAt = new Date().toISOString();
      return entry;
    });
  }
  @Delete(":id") remove(@Req() req: AuthRequest, @Param("id") id: string) {
    return this.store.update((state) => {
      owned(state.market, id, req.studioUser.id);
      state.market = state.market.filter((entry) => entry.id !== id);
      return { ok: true };
    });
  }
}
