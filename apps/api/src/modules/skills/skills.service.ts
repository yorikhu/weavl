import { BadRequestException, Injectable } from "@nestjs/common";
import type { AssetKind, MarketEntry } from "@weavl/shared";
import { newId } from "../../common/id";
import type { Skill } from "@prisma/client";
import { PrismaService } from "../../infrastructure/database/prisma.service";
@Injectable()
export class SkillsService {
  constructor(private readonly prisma: PrismaService) {}
  async list(userId: string) {
    return (
      await this.prisma.skill.findMany({
        where: { OR: [{ ownerId: userId }, { visibility: "official" }] },
        orderBy: { updatedAt: "desc" },
      })
    ).map((x) => this.map(x));
  }
  async create(
    userId: string,
    x: { title: string; description: string; content: string; inputHint: string; outputKind: AssetKind },
  ) {
    return this.map(
      await this.prisma.skill.create({ data: { id: newId("skill"), ownerId: userId, ...x, visibility: "private" } }),
    );
  }
  async update(
    id: string,
    userId: string,
    x: Partial<{ title: string; description: string; content: string; inputHint: string; outputKind: AssetKind }>,
  ) {
    await this.assertOwned(id, userId);
    return this.map(await this.prisma.skill.update({ where: { id }, data: { ...x, version: { increment: 1 } } }));
  }
  async remove(id: string, userId: string) {
    await this.assertOwned(id, userId);
    await this.prisma.skill.delete({ where: { id } });
    return { ok: true };
  }
  async accessible(ids: string[], userId: string) {
    if (!ids.length) return [];
    return (
      await this.prisma.skill.findMany({
        where: { id: { in: ids }, OR: [{ ownerId: userId }, { visibility: "official" }] },
      })
    ).map((x) => this.map(x));
  }
  private async assertOwned(id: string, userId: string) {
    if (!(await this.prisma.skill.findFirst({ where: { id, ownerId: userId }, select: { id: true } })))
      throw new BadRequestException("Skill 不存在或无权访问");
  }
  private map(x: Skill): MarketEntry {
    return {
      id: x.id,
      ownerId: x.ownerId,
      type: "skill",
      title: x.title,
      description: x.description,
      content: x.content,
      inputHint: x.inputHint,
      outputKind: x.outputKind as AssetKind,
      visibility: x.visibility as "official" | "private",
      version: x.version,
      createdAt: x.createdAt.toISOString(),
      updatedAt: x.updatedAt.toISOString(),
    };
  }
}
