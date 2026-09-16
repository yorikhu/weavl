import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { AuthRequest, parseBody } from "../../common/http";
import { SessionGuard } from "../auth/session.guard";
import { accountPlans, AccountService } from "./account.service";
@Controller("studio/account")
@UseGuards(SessionGuard)
export class AccountController {
  constructor(private readonly account: AccountService) {}
  @Get() summary(@Req() r: AuthRequest) {
    return this.account.summary(r.studioUser.id);
  }
  @Get("plans") plans() {
    return accountPlans;
  }
  @Post("plan-requests") request(@Req() r: AuthRequest, @Body() b: unknown) {
    const x = parseBody(z.object({ plan: z.enum(["Plus", "Pro", "Max"]) }), b);
    return this.account.requestPlan(r.studioUser.id, x.plan);
  }
  @Patch("events/:id/read") read(@Req() r: AuthRequest, @Param("id") id: string) {
    return this.account.markRead(r.studioUser.id, id);
  }
}
