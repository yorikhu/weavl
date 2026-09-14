import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import type { AccountPlan, AccountSummary } from "@weavl/shared";
import { AuthRequest, parseBody, SessionGuard } from "./http";
import { newId, StudioStore } from "./store";

const GB = 1024 ** 3;
const plans: AccountPlan[] = [
  { id: "Free", name: "免费版", storageLimit: 10 * GB, description: "个人探索与轻量创作", availability: "active" },
  { id: "Plus", name: "Plus", storageLimit: 50 * GB, description: "面向持续创作的个人用户", availability: "request" },
  { id: "Pro", name: "Pro", storageLimit: 200 * GB, description: "面向高频内容生产团队", availability: "request" },
  { id: "Max", name: "Max", storageLimit: 1024 * GB, description: "面向需要定制流程的业务线", availability: "request" },
];

@Controller("studio/account")
@UseGuards(SessionGuard)
export class AccountController {
  constructor(private readonly store: StudioStore) {}

  @Get()
  summary(@Req() req: AuthRequest): AccountSummary {
    const state = this.store.read();
    const account = state.accounts.find((item) => item.userId === req.studioUser.id);
    if (!account) throw new BadRequestException("账户不存在");
    const storageUsed = state.assets
      .filter((item) => item.ownerId === req.studioUser.id && !item.deletedAt)
      .reduce((total, asset) => total + (asset.versions.at(-1)?.size || 0), 0);
    return {
      plan: account.plan,
      credits: account.credits,
      storageUsed,
      storageLimit: plans.find((plan) => plan.id === account.plan)!.storageLimit,
      unreadNotifications: account.events.filter((event) => event.type !== "credit" && !event.readAt).length,
      pendingPlan: account.pendingPlan,
      events: [...account.events].reverse(),
    };
  }

  @Get("plans")
  listPlans(): AccountPlan[] {
    return plans;
  }

  @Post("plan-requests")
  requestPlan(@Req() req: AuthRequest, @Body() body: unknown) {
    const { plan } = parseBody(z.object({ plan: z.enum(["Plus", "Pro", "Max"]) }), body);
    const account = this.store.update((state) => {
      const item = state.accounts.find((record) => record.userId === req.studioUser.id);
      if (!item) throw new BadRequestException("账户不存在");
      if (item.pendingPlan === plan) throw new BadRequestException("已提交该套餐的开通意向");
      item.pendingPlan = plan;
      item.events.push({
        id: newId("event"),
        type: "plan_request",
        title: `${plan} 开通意向已记录`,
        detail: "当前为模拟阶段，尚未支付或开通套餐。",
        createdAt: new Date().toISOString(),
      });
      return item;
    });
    return { pendingPlan: account.pendingPlan };
  }

  @Patch("events/:id/read")
  markRead(@Req() req: AuthRequest, @Param("id") id: string) {
    return this.store.update((state) => {
      const account = state.accounts.find((record) => record.userId === req.studioUser.id);
      const event = account?.events.find((item) => item.id === id);
      if (!event) throw new BadRequestException("通知不存在");
      event.readAt = new Date().toISOString();
      return { ok: true };
    });
  }
}
