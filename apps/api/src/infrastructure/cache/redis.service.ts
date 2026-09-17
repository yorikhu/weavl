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
   * 原子递增计数器并从本次递增起刷新有效期。
   *
   * 适用于登录失败次数等滑动时间窗口，事务可避免并发请求造成计数或有效期丢失。
   *
   * @param key - 计数器缓存键。
   * @param ttlSeconds - 从本次递增开始计算的有效期，单位秒。
   * @returns 递增后的计数和当前剩余有效期。
   */
  async incrementWithExpiry(key: string, ttlSeconds: number) {
    const results = await this.client.multi().incr(key).expire(key, ttlSeconds).ttl(key).exec();
    const count = Number(results?.[0]?.[1] ?? 0);
    const remainingTtlSeconds = Number(results?.[2]?.[1] ?? ttlSeconds);
    return { count, remainingTtlSeconds };
  }

  /**
   * 读取缓存键的剩余有效期。
   *
   * @param key - 缓存键。
   * @returns 剩余秒数；Redis 的负数返回值表示键不存在或没有有效期。
   */
  ttl(key: string) {
    return this.client.ttl(key);
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
