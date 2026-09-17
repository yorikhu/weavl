import { Injectable, OnApplicationShutdown, OnModuleInit } from "@nestjs/common";
import Redis from "ioredis";

@Injectable()
export class RedisService implements OnModuleInit, OnApplicationShutdown {
  private readonly client = new Redis(process.env.REDIS_URL || "redis://127.0.0.1:6379", {
    lazyConnect: true,
    maxRetriesPerRequest: 2,
  });

  /**
   * 初始化服务依赖。
   *
   * @returns 生命周期处理完成后的 Promise。
   */
  async onModuleInit() {
    await this.client.connect();
    await this.client.ping();
  }

  /**
   * 读取Redis 缓存详情。
   *
   * @param key - 缓存键。
   * @returns 读取Redis 缓存详情后的结果。
   */
  get(key: string) {
    return this.client.get(key);
  }
  /**
   * 写入 Redis 缓存。
   *
   * @param key - 缓存键。
   * @param value - 缓存值。
   * @param ttlSeconds - 缓存有效期，单位秒。
   * @returns 写入 Redis 缓存后的结果。
   */
  set(key: string, value: string, ttlSeconds: number) {
    return this.client.set(key, value, "EX", ttlSeconds);
  }
  /**
   * 删除Redis 缓存。
   *
   * @param key - 缓存键。
   * @returns 删除Redis 缓存后的结果。
   */
  delete(key: string) {
    return this.client.del(key);
  }
  /**
   * 检查 Redis 连接。
   *
   * @returns 检查 Redis 连接后的结果。
   */
  ping() {
    return this.client.ping();
  }
  /**
   * 关闭服务持有的外部连接。
   *
   * @returns 生命周期处理完成后的 Promise。
   */
  async onApplicationShutdown() {
    await this.client.quit();
  }
}
