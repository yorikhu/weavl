import { BadRequestException } from "@nestjs/common";
import type { Request } from "express";
import type { StudioUser } from "@weavl/shared";
import { z } from "zod";

export type AuthRequest = Request & { studioUser: StudioUser; sessionToken: string };

/**
 * 从请求 Cookie 中读取 Weavl 会话令牌。
 *
 * @param request - Express 请求对象。
 * @returns 会话令牌；请求未携带登录 Cookie 时返回 `undefined`。
 */
export const sessionToken = (request: Request): string | undefined =>
  request.headers.cookie
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("weavl_session="))
    ?.slice("weavl_session=".length);

/**
 * 使用 Zod 校验未知请求体，并将首个校验错误转换为 HTTP 400。
 *
 * @template T - Zod Schema 类型。
 * @param schema - 用于校验请求体的 Schema。
 * @param value - 尚未校验的输入值。
 * @returns 通过 Schema 推导的安全输入。
 * @throws {BadRequestException} 输入未通过 Schema 校验时抛出。
 */
export function parseBody<T extends z.ZodType>(schema: T, value: unknown): z.infer<T> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message || "请求参数不正确");
  return parsed.data;
}
