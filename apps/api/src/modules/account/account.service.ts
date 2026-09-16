import { BadRequestException, Injectable } from "@nestjs/common";
import type { AccountPlan, AccountPlanId, AccountSummary } from "@weavl/shared";
import { newId } from "../../common/id";
import { PrismaService } from "../../infrastructure/database/prisma.service";
const GB = 1024 ** 3;
export const accountPlans: AccountPlan[] = [
  { id: "Free", name: "免费版", storageLimit: 10 * GB, description: "个人探索与轻量创作", availability: "active" },
  { id: "Plus", name: "Plus", storageLimit: 50 * GB, description: "面向持续创作的个人用户", availability: "request" },
  { id: "Pro", name: "Pro", storageLimit: 200 * GB, description: "面向高频内容生产团队", availability: "request" },
  { id: "Max", name: "Max", storageLimit: 1024 * GB, description: "面向需要定制流程的业务线", availability: "request" },
];
@Injectable()
export class AccountService {
  constructor(private readonly prisma: PrismaService) {}
  async summary(userId: string): Promise<AccountSummary> {
    const [account, assets] = await Promise.all([
      this.prisma.account.findUnique({
        where: { userId },
        include: { user: { select: { accountEvents: { orderBy: { createdAt: "desc" } } } } },
      }),
      this.prisma.asset.findMany({
        where: { ownerId: userId, deletedAt: null },
        select: { versions: { orderBy: { createdAt: "desc" }, take: 1, select: { size: true } } },
      }),
    ]);
    if (!account) throw new BadRequestException("账户不存在");
    const events = account.user.accountEvents;
    return {
      plan: account.plan as AccountPlanId,
      credits: account.credits,
      storageUsed: assets.reduce((sum, a) => sum + Number(a.versions[0]?.size || 0), 0),
      storageLimit: accountPlans.find((x) => x.id === account.plan)!.storageLimit,
      unreadNotifications: events.filter((x) => x.type !== "credit" && !x.readAt).length,
      pendingPlan: account.pendingPlan as AccountPlanId | undefined,
      events: events.map((x) => ({
        id: x.id,
        type: x.type as "credit" | "plan_request" | "notice",
        title: x.title,
        detail: x.detail,
        delta: x.delta ?? undefined,
        readAt: x.readAt?.toISOString(),
        createdAt: x.createdAt.toISOString(),
      })),
    };
  }
  async requestPlan(userId: string, plan: Exclude<AccountPlanId, "Free">) {
    const account = await this.prisma.account.findUnique({ where: { userId } });
    if (!account) throw new BadRequestException("账户不存在");
    if (account.pendingPlan === plan) throw new BadRequestException("已提交该套餐的开通意向");
    await this.prisma.$transaction([
      this.prisma.account.update({ where: { userId }, data: { pendingPlan: plan } }),
      this.prisma.accountEvent.create({
        data: {
          id: newId("event"),
          userId,
          type: "plan_request",
          title: `${plan} 开通意向已记录`,
          detail: "当前为内部测试阶段，尚未支付或开通套餐。",
        },
      }),
    ]);
    return { pendingPlan: plan };
  }
  async markRead(userId: string, id: string) {
    const result = await this.prisma.accountEvent.updateMany({ where: { id, userId }, data: { readAt: new Date() } });
    if (!result.count) throw new BadRequestException("通知不存在");
    return { ok: true };
  }
}
