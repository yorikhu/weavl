import { Body, Controller, Get, Post, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { parseBody, sessionToken } from "../../common/http";
import { AuthService } from "./auth.service";
import { SessionService } from "./session.service";

const credentials = z.object({ email: z.email(), password: z.string().min(8) });
const cookieBase = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
  ) {}

  /**
   * 读取当前登录用户。
   *
   * @param request - 已通过认证的请求对象。
   * @returns 读取当前登录用户后的结果。
   */
  @Get("me")
  me(@Req() request: Request) {
    return this.sessions.userFromToken(sessionToken(request));
  }

  /**
   * 登录并创建会话。
   *
   * @param body - 尚未校验的请求体。
   * @param response - 用于写入 Cookie 的响应对象。
   * @returns 登录并创建会话后的结果。
   */
  @Post("login")
  async login(@Body() body: unknown, @Res({ passthrough: true }) response: Response) {
    const input = parseBody(credentials, body);
    const result = await this.auth.login(input.email, input.password);
    response.cookie("weavl_session", result.session.token, { ...cookieBase, maxAge: result.session.maxAge });
    return result.user;
  }

  /**
   * 注销当前会话。
   *
   * @param request - 已通过认证的请求对象。
   * @param response - 用于写入 Cookie 的响应对象。
   * @returns 注销当前会话后的结果。
   */
  @Post("logout")
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    await this.sessions.revoke(sessionToken(request));
    response.clearCookie("weavl_session", { path: "/" });
    return { ok: true };
  }
}
