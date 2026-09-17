import { BadRequestException, Injectable } from "@nestjs/common";
import type { AgentConversation, ModelKind } from "@weavl/shared";
import { newId } from "../../common/id";
import type { Conversation } from "@prisma/client";
import { PrismaService } from "../../infrastructure/database/prisma.service";
import { AssetsService } from "../assets/assets.service";
import { TextGenerationService } from "../generations/text-generation.service";
import { ProjectsService } from "../projects/projects.service";
import { SkillsService } from "../skills/skills.service";

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assets: AssetsService,
    private readonly skills: SkillsService,
    private readonly projects: ProjectsService,
    private readonly generation: TextGenerationService,
  ) {}
  /**
   * 读取Agent 会话列表。
   *
   * @param ownerId - 当前用户 ID。
   * @returns 读取Agent 会话列表后的结果。
   */
  async list(ownerId: string) {
    const rows = await this.prisma.conversation.findMany({
      where: { ownerId },
      include: { messages: { include: { assetRefs: true }, orderBy: { createdAt: "asc" } } },
      orderBy: { updatedAt: "desc" },
    });
    return rows.map((x) => this.map(x));
  }
  /**
   * 读取Agent 会话详情。
   *
   * @param id - 资源标识。
   * @param ownerId - 当前用户 ID。
   * @returns 读取Agent 会话详情后的结果。
   */
  async get(id: string, ownerId: string) {
    const row = await this.prisma.conversation.findFirst({
      where: { id, ownerId },
      include: { messages: { include: { assetRefs: true }, orderBy: { createdAt: "asc" } } },
    });
    if (!row) throw new BadRequestException("会话不存在或无权访问");
    return this.map(row);
  }
  /**
   * 创建Agent 会话。
   *
   * @param ownerId - 当前用户 ID。
   * @param title - 该操作所需的业务参数。
   * @returns 创建Agent 会话后的结果。
   */
  async create(ownerId: string, title: string) {
    const row = await this.prisma.conversation.create({
      data: { id: newId("conversation"), ownerId, title },
      include: { messages: { include: { assetRefs: true } } },
    });
    return this.map(row);
  }
  /**
   * 更新Agent 会话。
   *
   * @param id - 资源标识。
   * @param ownerId - 当前用户 ID。
   * @param input - 业务输入数据。
   * @returns 更新Agent 会话后的结果。
   */
  async update(id: string, ownerId: string, input: { title?: string; archived?: boolean; projectId?: string }) {
    await this.assertOwned(id, ownerId);
    if (input.projectId) await this.projects.get(input.projectId, ownerId);
    await this.prisma.conversation.update({ where: { id }, data: { ...input, updatedAt: new Date() } });
    return this.get(id, ownerId);
  }
  /**
   * 发送 Agent 会话消息。
   *
   * @param id - 资源标识。
   * @param ownerId - 当前用户 ID。
   * @param input - 业务输入数据。
   * @returns 发送 Agent 会话消息后的结果。
   */
  async send(
    id: string,
    ownerId: string,
    input: {
      content: string;
      assetIds: string[];
      marketEntryIds?: string[];
      marketEntryId?: string;
      modelKinds?: ModelKind[];
      modelKind?: ModelKind;
    },
  ) {
    const conversation = await this.get(id, ownerId);
    const assets = await this.assets.getManyOwned(input.assetIds, ownerId);
    const skillIds = [...new Set(input.marketEntryIds ?? (input.marketEntryId ? [input.marketEntryId] : []))];
    const skills = await this.skills.accessible(skillIds, ownerId);
    const kinds = [...new Set(input.modelKinds?.length ? input.modelKinds : [input.modelKind || "text"])];
    const source = assets.length ? `\n参考资产：${assets.map((x) => x.name).join("、")}` : "";
    const method = skills.length ? `\n使用方法：\n${skills.map((x) => `${x.title}。${x.content}`).join("\n")}` : "";
    const labels: { [K in ModelKind]: string } = {
      text: "文本",
      image: "图片",
      video: "视频",
      audio: "音频",
      avatar: "数字人",
    };
    const generated = await this.generation.generate(
      ownerId,
      "weavl-text",
      `目标：${input.content}${source}${method}\n输出类型：${kinds.map((x) => labels[x]).join("、")}`,
    );
    const asset = await this.assets.create({
      ownerId,
      name: `${input.content.slice(0, 28)} · 草稿`,
      kind: "text",
      source: "agent",
      sourceId: id,
      inLibrary: false,
      content: generated.content,
    });
    const userMessageId = newId("message"),
      replyId = newId("message");
    await this.prisma.$transaction(async (tx) => {
      await tx.conversationMessage.create({
        data: {
          id: userMessageId,
          conversationId: id,
          role: "user",
          content: input.content,
          assetRefs: { create: assets.map((x) => ({ assetId: x.id, versionId: x.versions.at(-1)!.id })) },
        },
      });
      await tx.conversationMessage.create({
        data: {
          id: replyId,
          conversationId: id,
          role: "assistant",
          content: generated.content,
          assetRefs: { create: { assetId: asset.id, versionId: asset.versions[0]!.id } },
        },
      });
      await tx.conversation.update({
        where: { id },
        data: {
          title:
            conversation.messages.length === 0 && conversation.title === "新会话"
              ? input.content.slice(0, 35)
              : undefined,
          updatedAt: new Date(),
        },
      });
    });
    const updated = await this.get(id, ownerId);
    return { conversation: updated, reply: updated.messages.find((x) => x.id === replyId), asset };
  }
  /**
   * 将会话转换为项目。
   *
   * @param id - 资源标识。
   * @param ownerId - 当前用户 ID。
   * @param assetIds - 该操作所需的业务参数。
   * @param name - 该操作所需的业务参数。
   * @returns 将会话转换为项目后的结果。
   */
  async toProject(id: string, ownerId: string, assetIds: string[], name?: string) {
    const conversation = await this.get(id, ownerId);
    const available = new Set(conversation.messages.flatMap((x) => x.assetRefs.map((ref) => ref.assetId)));
    const project = await this.projects.create(ownerId, {
      name: name || conversation.title,
      assetIds: assetIds.filter((x) => available.has(x)),
    });
    await this.prisma.conversation.update({ where: { id }, data: { projectId: project.id, updatedAt: new Date() } });
    return project;
  }
  /**
   * 删除Agent 会话。
   *
   * @param id - 资源标识。
   * @param ownerId - 当前用户 ID。
   * @returns 删除Agent 会话后的结果。
   */
  async remove(id: string, ownerId: string) {
    await this.assertOwned(id, ownerId);
    await this.prisma.conversation.delete({ where: { id } });
    return { ok: true };
  }
  private async assertOwned(id: string, ownerId: string) {
    if (!(await this.prisma.conversation.findFirst({ where: { id, ownerId }, select: { id: true } })))
      throw new BadRequestException("会话不存在或无权访问");
  }
  private map(
    row: Conversation & {
      messages: Array<{
        id: string;
        role: string;
        content: string;
        createdAt: Date;
        assetRefs: Array<{ assetId: string; versionId: string }>;
      }>;
    },
  ): AgentConversation {
    return {
      id: row.id,
      ownerId: row.ownerId,
      title: row.title,
      archived: row.archived,
      projectId: row.projectId || undefined,
      messages: row.messages.map((x) => ({
        id: x.id,
        role: x.role as "user" | "assistant",
        content: x.content,
        assetRefs: x.assetRefs.map((ref) => ({ assetId: ref.assetId, versionId: ref.versionId })),
        createdAt: x.createdAt.toISOString(),
      })),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
