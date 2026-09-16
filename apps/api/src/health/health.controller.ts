import { Controller, Get } from "@nestjs/common";
import { RedisService } from "../infrastructure/cache/redis.service";
import { PrismaService } from "../infrastructure/database/prisma.service";
import { ObjectStorageService } from "../infrastructure/storage/object-storage.service";

@Controller("health")
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly storage: ObjectStorageService,
  ) {}

  @Get()
  async check() {
    const [database, redis, storage] = await Promise.all([
      this.prisma.user.count().then(() => "healthy"),
      this.redis.ping().then(() => "healthy"),
      this.storage.health().then((ready) => (ready ? "healthy" : "unavailable")),
    ]);
    return {
      ok: true,
      service: "weavl-api",
      dependencies: { database, redis, storage },
      timestamp: new Date().toISOString(),
    };
  }
}
