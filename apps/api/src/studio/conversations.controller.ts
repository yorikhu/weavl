import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import type { AgentConversation, AssetRef } from "@weavl/shared";
import { AuthRequest, owned, parseBody, SessionGuard } from "./http";
import { newId, StudioStore } from "./store";

@Controller("studio/conversations")
@UseGuards(SessionGuard)
export class ConversationsController {
  constructor(private readonly store: StudioStore) {}
  @Get() list(@Req() req: AuthRequest) {
    return this.store
      .read()
      .conversations.filter((item) => item.ownerId === req.studioUser.id)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  @Get(":id") get(@Req() req: AuthRequest, @Param("id") id: string) {
    return owned(this.store.read().conversations, id, req.studioUser.id);
  }

  @Post() create(@Req() req: AuthRequest, @Body() body: unknown): AgentConversation {
    const input = parseBody(z.object({ title: z.string().trim().min(1).max(100).default("新会话") }), body);
    const stamp = new Date().toISOString();
    const conversation: AgentConversation = {
      id: newId("conversation"),
      ownerId: req.studioUser.id,
      title: input.title,
      archived: false,
      messages: [],
      createdAt: stamp,
      updatedAt: stamp,
    };
    this.store.update((state) => state.conversations.push(conversation));
    return conversation;
  }

  @Patch(":id") update(@Req() req: AuthRequest, @Param("id") id: string, @Body() body: unknown) {
    const input = parseBody(
      z.object({
        title: z.string().trim().min(1).max(100).optional(),
        archived: z.boolean().optional(),
        projectId: z.string().optional(),
      }),
      body,
    );
    if (input.projectId) owned(this.store.read().projects, input.projectId, req.studioUser.id);
    return this.store.update((state) => {
      const conversation = owned(state.conversations, id, req.studioUser.id);
      Object.assign(conversation, input, { updatedAt: new Date().toISOString() });
      return conversation;
    });
  }

  @Post(":id/messages")
  send(@Req() req: AuthRequest, @Param("id") id: string, @Body() body: unknown) {
    const input = parseBody(
      z.object({
        content: z.string().trim().min(1).max(10000),
        assetIds: z.array(z.string()).default([]),
        marketEntryIds: z.array(z.string()).max(20).optional(),
        modelKinds: z.array(z.enum(["text", "image", "video", "audio", "avatar"])).max(5).optional(),
        marketEntryId: z.string().optional(),
        modelKind: z.enum(["text", "image", "video", "audio", "avatar"]).optional(),
      }),
      body,
    );
    const conversation = owned(this.store.read().conversations, id, req.studioUser.id);
    const assets = input.assetIds.map((assetId) =>
      owned(
        this.store.read().assets.filter((asset) => !asset.deletedAt),
        assetId,
        req.studioUser.id,
      ),
    );
    const methodIds = [...new Set(input.marketEntryIds ?? (input.marketEntryId ? [input.marketEntryId] : []))];
    const selectedMethods = methodIds
      .map((methodId) => this.store.read().market.find((entry) =>
        entry.id === methodId && (entry.ownerId === req.studioUser.id || entry.visibility === "official"),
      ))
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
    const modelKinds = [...new Set(input.modelKinds?.length ? input.modelKinds : [input.modelKind || "text"])];
    const stamp = new Date().toISOString();
    const userMessage = {
      id: newId("message"),
      role: "user" as const,
      content: input.content,
      assetRefs: assets.map((asset) => ({ assetId: asset.id, versionId: asset.versions.at(-1)!.id })),
      createdAt: stamp,
    };
    const sourceList = assets.length ? `\n参考资产：${assets.map((asset) => asset.name).join("、")}` : "";
    const method = selectedMethods.length
      ? `\n使用方法：\n${selectedMethods.map((entry) => `${entry.title}。${entry.content}`).join("\n")}`
      : "";
    const modelLabels = { text: "文本", image: "图片", video: "视频", audio: "音频", avatar: "数字人" };
    const modelLabel = modelKinds.map((kind) => `${modelLabels[kind]}模型`).join("、");
    const content = `【${modelLabel} · 模拟文字稿，尚未生成媒体】\n\n目标：${input.content}${sourceList}${method}\n\n建议先明确交付对象与成功标准，再按“背景 → 核心观点 → 执行步骤 → 待确认事项”组织内容。\n\n1. 背景与目的：围绕「${input.content.slice(0, 55)}」说明要解决的问题。\n2. 核心内容：结合已有资料形成清晰的初稿，再标记需要核实的事实。\n3. 下一步：选择其中一版继续修改，或保存到项目画布。`;
    const asset = this.store.createAsset({
      ownerId: req.studioUser.id,
      name: `${input.content.slice(0, 28)} · 草稿`,
      kind: "text",
      source: "agent",
      sourceId: conversation.id,
      content,
    });
    const assetRef: AssetRef = { assetId: asset.id, versionId: asset.versions[0]!.id };
    const reply = {
      id: newId("message"),
      role: "assistant" as const,
      content,
      assetRefs: [assetRef],
      createdAt: new Date().toISOString(),
    };
    this.store.update((state) => {
      const current = owned(state.conversations, conversation.id, req.studioUser.id);
      current.messages.push(userMessage, reply);
      if (current.messages.length === 2 && current.title === "新会话") current.title = input.content.slice(0, 35);
      current.updatedAt = new Date().toISOString();
    });
    return { conversation: this.store.read().conversations.find((item) => item.id === id), reply, asset };
  }

  @Post(":id/project")
  toProject(@Req() req: AuthRequest, @Param("id") id: string, @Body() body: unknown) {
    const input = parseBody(
      z.object({ assetIds: z.array(z.string()).default([]), name: z.string().trim().min(1).max(80).optional() }),
      body,
    );
    const conversation = owned(this.store.read().conversations, id, req.studioUser.id);
    const available = new Set(conversation.messages.flatMap((message) => message.assetRefs.map((ref) => ref.assetId)));
    const assets = input.assetIds
      .filter((assetId) => available.has(assetId))
      .map((assetId) => owned(this.store.read().assets, assetId, req.studioUser.id));
    const stamp = new Date().toISOString();
    const project = {
      id: newId("project"),
      ownerId: req.studioUser.id,
      name: input.name || conversation.title,
      canvases: [
        {
          id: newId("canvas"),
          name: "主画布",
          nodes: assets.map((asset, index) => ({
            id: newId("node"),
            type: "text",
            position: { x: 120 + (index % 3) * 340, y: 120 + Math.floor(index / 3) * 230 },
            data: {
              nodeKind: "text",
              title: asset.name,
              text: asset.versions.at(-1)?.content || "",
              assetRef: { assetId: asset.id, versionId: asset.versions.at(-1)!.id },
              source: asset.source,
            },
          })),
          edges: [],
          viewport: { x: 0, y: 0, zoom: 1 },
          updatedAt: stamp,
        },
      ],
      createdAt: stamp,
      updatedAt: stamp,
    };
    this.store.update((state) => {
      state.projects.push(project);
      owned(state.conversations, id, req.studioUser.id).projectId = project.id;
    });
    return project;
  }

  @Delete(":id") remove(@Req() req: AuthRequest, @Param("id") id: string) {
    return this.store.update((state) => {
      owned(state.conversations, id, req.studioUser.id);
      state.conversations = state.conversations.filter((item) => item.id !== id);
      return { ok: true };
    });
  }
}
