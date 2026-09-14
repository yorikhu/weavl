import { Body, Controller, Get, Post, Req, Res, UnauthorizedException } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { compareSync, hashSync } from "bcryptjs";
import type { Request, Response } from "express";
import { z } from "zod";
import { parseBody, sessionHash, sessionToken } from "./http";
import { newId, StudioStore, welcomeAccount } from "./store";

const credentials = z.object({ email: z.email(), password: z.string().min(8) });
const registration = credentials.extend({ name: z.string().trim().min(1).max(60) });
const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

@Controller("auth")
export class AuthController {
  constructor(private readonly store: StudioStore) {}

  @Get("me")
  me(@Req() request: Request) {
    return this.store.userFromToken(sessionToken(request));
  }

  @Post("register")
  register(@Body() body: unknown, @Res({ passthrough: true }) response: Response) {
    const input = parseBody(registration, body);
    const email = input.email.toLowerCase();
    if (this.store.read().users.some((user) => user.email === email)) throw new UnauthorizedException("邮箱已注册");
    const user = {
      id: newId("user"),
      email,
      name: input.name,
      passwordHash: hashSync(input.password, 10),
      createdAt: new Date().toISOString(),
    };
    this.store.update((state) => {
      state.users.push(user);
      state.accounts.push(welcomeAccount(user.id));
    });
    return this.startSession(user.id, response);
  }

  @Post("login")
  login(@Body() body: unknown, @Res({ passthrough: true }) response: Response) {
    const input = parseBody(credentials, body);
    const user = this.store.read().users.find((item) => item.email === input.email.toLowerCase());
    if (!user || !compareSync(input.password, user.passwordHash)) throw new UnauthorizedException("邮箱或密码不正确");
    return this.startSession(user.id, response);
  }

  @Post("logout")
  logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const token = sessionToken(request);
    if (token)
      this.store.update((state) => {
        state.sessions = state.sessions.filter((item) => item.tokenHash !== sessionHash(token));
      });
    response.clearCookie("weavl_session", { path: "/" });
    return { ok: true };
  }

  private startSession(userId: string, response: Response) {
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + cookieOptions.maxAge).toISOString();
    this.store.update((state) =>
      state.sessions.push({ id: newId("session"), userId, tokenHash: sessionHash(token), expiresAt }),
    );
    response.cookie("weavl_session", token, cookieOptions);
    const user = this.store.read().users.find((item) => item.id === userId)!;
    return { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt };
  }
}
