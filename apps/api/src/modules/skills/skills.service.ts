import { BadRequestException, Injectable } from "@nestjs/common";
import type { AssetKind, MarketEntry } from "@weavl/shared";
import { newId } from "../../common/id";
import type { Skill } from "@prisma/client";
import { PrismaService } from "../../infrastructure/database/prisma.service";
@Injectable()
export class SkillsService {
  constructor(private readonly prisma: PrismaService) {}
  /**
   * 读取Skill列表。
   *
   * @param userId - 当前用户 ID。
   * @returns 读取Skill列表后的结果。
   */
  async list(userId: string) {
    return (
      await this.prisma.skill.findMany({
        where: { OR: [{ ownerId: userId }, { visibility: "official" }] },
        orderBy: { updatedAt: "desc" },
      })
    ).map((x) => this.map(x));
  }
  /**
   * 创建Skill。
   *
   * @param userId - 当前用户 ID。
   * @param x - 该操作所需的业务参数。
   * @returns 创建Skill后的结果。
   */
  async create(
    userId: string,
    x: { title: string; description: string; content: string; inputHint: string; outputKind: AssetKind },
  ) {
    return this.map(
      await this.prisma.skill.create({ data: { id: newId("skill"), ownerId: userId, ...x, visibility: "private" } }),
    );
  }
  /**
   * 更新Skill。
   *
   * @param id - 资源标识。
   * @param userId - 当前用户 ID。
   * @param x - 该操作所需的业务参数。
   * @returns 更新Skill后的结果。
   */
  async update(
    id: string,
    userId: string,
    x: Partial<{ title: string; description: string; content: string; inputHint: string; outputKind: AssetKind }>,
  ) {
    await this.assertOwned(id, userId);
    return this.map(await this.prisma.skill.update({ where: { id }, data: { ...x, version: { increment: 1 } } }));
  }
  /**
   * 删除Skill。
   *
   * @param id - 资源标识。
   * @param userId - 当前用户 ID。
   * @returns 删除Skill后的结果。
   */
  async remove(id: string, userId: string) {
    await this.assertOwned(id, userId);
    await this.prisma.skill.delete({ where: { id } });
    return { ok: true };
  }
  /**
   * 读取可用 Skill。
   *
   * @remarks
   * 查询同时要求 Skill 位于请求的 ID 集合中，并满足以下任一访问条件：属于
   * 当前用户，或由平台标记为官方 Skill。
   *
   * @param ids - 资源标识列表。
   * @param userId - 当前用户 ID。
   * @returns 读取可用 Skill后的结果。
   */
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
