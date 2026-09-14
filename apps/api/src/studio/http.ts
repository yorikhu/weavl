import { BadRequestException, CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { createHash } from "node:crypto";
import type { Request } from "express";
import type { StudioUser } from "@weavl/shared";
import { z } from "zod";
import { StudioStore } from "./store";

export type AuthRequest = Request & { studioUser: StudioUser };
export const sessionHash = (token: string) => createHash("sha256").update(token).digest("hex");
export const sessionToken = (req: Request): string | undefined =>
  req.headers.cookie
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("weavl_session="))
    ?.slice("weavl_session=".length);

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly store: StudioStore) {}
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const user = this.store.userFromToken(sessionToken(request));
    if (!user) throw new UnauthorizedException("请先登录");
    request.studioUser = user;
    return true;
  }
}

export function parseBody<T extends z.ZodType>(schema: T, value: unknown): z.infer<T> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message || "请求参数不正确");
  return parsed.data;
}

export function owned<T extends { id: string; ownerId: string | null }>(items: T[], id: string, userId: string): T {
  const item = items.find((entry) => entry.id === id && entry.ownerId === userId);
  if (!item) throw new BadRequestException("对象不存在或无权访问");
  return item;
}
