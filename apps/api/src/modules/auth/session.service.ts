import { Injectable } from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";
import type { StudioUser } from "@weavl/shared";
import { newId } from "../../common/id";
import { RedisService } from "../../infrastructure/cache/redis.service";
import { PrismaService } from "../../infrastructure/database/prisma.service";

const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
const SESSION_KEY_PREFIX = `${process.env.WEAVL_REDIS_PREFIX || "weavl"}:session:`;
export const sessionHash = (token: string) => createHash("sha256").update(token).digest("hex");
const sessionKey = (hash: string) => `${SESSION_KEY_PREFIX}${hash}`;

@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async create(userId: string) {
    const token = randomBytes(32).toString("hex");
    const hash = sessionHash(token);
    const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
    await this.prisma.session.create({ data: { id: newId("session"), userId, tokenHash: hash, expiresAt } });
    await this.redis.set(sessionKey(hash), userId, SESSION_TTL_SECONDS);
    return { token, maxAge: SESSION_TTL_SECONDS * 1000 };
  }

  async userFromToken(token?: string): Promise<StudioUser | null> {
    if (!token) return null;
    const hash = sessionHash(token);
    let userId = await this.redis.get(sessionKey(hash));
    if (!userId) {
      const session = await this.prisma.session.findFirst({
        where: { tokenHash: hash, expiresAt: { gt: new Date() } },
      });
      if (!session) return null;
      userId = session.userId;
      const ttl = Math.max(1, Math.floor((session.expiresAt.getTime() - Date.now()) / 1000));
      await this.redis.set(sessionKey(hash), userId, ttl);
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    return user ? { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt.toISOString() } : null;
  }

  async revoke(token?: string) {
    if (!token) return;
    const hash = sessionHash(token);
    await Promise.all([
      this.prisma.session.deleteMany({ where: { tokenHash: hash } }),
      this.redis.delete(sessionKey(hash)),
    ]);
  }
}
