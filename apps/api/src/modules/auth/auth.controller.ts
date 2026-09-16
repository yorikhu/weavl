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

  @Get("me")
  me(@Req() request: Request) {
    return this.sessions.userFromToken(sessionToken(request));
  }

  @Post("login")
  async login(@Body() body: unknown, @Res({ passthrough: true }) response: Response) {
    const input = parseBody(credentials, body);
    const result = await this.auth.login(input.email, input.password);
    response.cookie("weavl_session", result.session.token, { ...cookieBase, maxAge: result.session.maxAge });
    return result.user;
  }

  @Post("logout")
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    await this.sessions.revoke(sessionToken(request));
    response.clearCookie("weavl_session", { path: "/" });
    return { ok: true };
  }
}
