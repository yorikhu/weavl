import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { AuthRequest, parseBody } from "../../common/http";
import { SessionGuard } from "../auth/session.guard";
import { accountPlans, AccountService } from "./account.service";
@Controller("studio/account")
@UseGuards(SessionGuard)
export class AccountController {
  constructor(private readonly account: AccountService) {}
  /**
   * 读取账户摘要。
   *
   * @param r - 该操作所需的业务参数。
   * @returns 读取账户摘要后的结果。
   */
  @Get() summary(@Req() r: AuthRequest) {
    return this.account.summary(r.studioUser.id);
  }
  /**
   * 读取套餐列表。
   *
   * @returns 读取套餐列表后的结果。
   */
  @Get("plans") plans() {
    return accountPlans;
  }
  /**
   * 提交套餐开通意向。
   *
   * @param r - 该操作所需的业务参数。
   * @param b - 该操作所需的业务参数。
   * @returns 提交套餐开通意向后的结果。
   */
  @Post("plan-requests") request(@Req() r: AuthRequest, @Body() b: unknown) {
    const x = parseBody(z.object({ plan: z.enum(["Plus", "Pro", "Max"]) }), b);
    return this.account.requestPlan(r.studioUser.id, x.plan);
  }
  /**
   * 标记账户事件已读。
   *
   * @param r - 该操作所需的业务参数。
   * @param id - 资源标识。
   * @returns 标记账户事件已读后的结果。
   */
  @Patch("events/:id/read") read(@Req() r: AuthRequest, @Param("id") id: string) {
    return this.account.markRead(r.studioUser.id, id);
  }
}
