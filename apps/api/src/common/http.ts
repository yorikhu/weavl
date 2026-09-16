import { BadRequestException } from "@nestjs/common";
import type { Request } from "express";
import type { StudioUser } from "@weavl/shared";
import { z } from "zod";

export type AuthRequest = Request & { studioUser: StudioUser; sessionToken: string };

export const sessionToken = (request: Request): string | undefined =>
  request.headers.cookie
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("weavl_session="))
    ?.slice("weavl_session=".length);

export function parseBody<T extends z.ZodType>(schema: T, value: unknown): z.infer<T> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message || "请求参数不正确");
  return parsed.data;
}
