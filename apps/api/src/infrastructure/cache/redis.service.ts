import { Injectable, OnApplicationShutdown, OnModuleInit } from "@nestjs/common";
import Redis from "ioredis";

@Injectable()
export class RedisService implements OnModuleInit, OnApplicationShutdown {
  private readonly client = new Redis(process.env.REDIS_URL || "redis://127.0.0.1:6379", {
    lazyConnect: true,
    maxRetriesPerRequest: 2,
  });

  async onModuleInit() {
    await this.client.connect();
    await this.client.ping();
  }

  get(key: string) {
    return this.client.get(key);
  }
  set(key: string, value: string, ttlSeconds: number) {
    return this.client.set(key, value, "EX", ttlSeconds);
  }
  delete(key: string) {
    return this.client.del(key);
  }
  ping() {
    return this.client.ping();
  }
  async onApplicationShutdown() {
    await this.client.quit();
  }
}
