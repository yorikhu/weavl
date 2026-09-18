import { Injectable } from "@nestjs/common";
import Redis from "ioredis";

const ACQUIRE_SLOT_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local expiresAt = tonumber(ARGV[2])
local token = ARGV[3]
local slotLimit = tonumber(ARGV[4])
local ttl = tonumber(ARGV[5])

redis.call("ZREMRANGEBYSCORE", key, "-inf", now)
if redis.call("ZSCORE", key, token) then
  redis.call("ZADD", key, expiresAt, token)
  redis.call("PEXPIRE", key, ttl)
  return 1
end
if redis.call("ZCARD", key) >= slotLimit then
  return 0
end
redis.call("ZADD", key, expiresAt, token)
redis.call("PEXPIRE", key, ttl)
return 1
`;

const RENEW_SLOT_SCRIPT = `
local key = KEYS[1]
local token = ARGV[1]
local expiresAt = tonumber(ARGV[2])
local ttl = tonumber(ARGV[3])

if redis.call("ZSCORE", key, token) then
  redis.call("ZADD", key, expiresAt, token)
  redis.call("PEXPIRE", key, ttl)
  return 1
end
return 0
`;

/**
 * 使用 Redis 租约限制单个用户同时执行的生成任务数量。
 *
 * @remarks
 * 每个用户对应一个有序集合，成员是当前任务的唯一租约令牌，分值是租约过期
 * 时间。Lua 脚本保证清理过期租约、计数和占位是原子操作，因此增加 Worker
 * 副本后仍遵守同一限制。进程异常退出时，租约会在超时后自动释放。
 */
@Injectable()
export class GenerationUserConcurrencyService {
  private readonly connection = new Redis(process.env.REDIS_URL || "redis://127.0.0.1:6379", {
    maxRetriesPerRequest: null,
  });
  private readonly keyPrefix = `${process.env.WEAVL_QUEUE_PREFIX || "weavl:queue"}:user-slots`;
  private readonly slotLimit = this.readPositiveInteger(process.env.WEAVL_GENERATION_USER_CONCURRENCY, 2);
  private readonly leaseMs = this.readPositiveInteger(process.env.WEAVL_GENERATION_USER_SLOT_LEASE_MS, 300_000);

  /** 单用户任务达到上限后，再次尝试获取执行槽位的等待时间。 */
  readonly retryDelayMs = this.readPositiveInteger(process.env.WEAVL_GENERATION_USER_SLOT_RETRY_DELAY_MS, 500);

  /** 租约续期频率，至少每秒一次且早于租约过期。 */
  readonly renewalIntervalMs = Math.max(1_000, Math.floor(this.leaseMs / 3));

  /**
   * 原子获取一个用户执行槽位。
   *
   * @param ownerId - 任务所属用户。
   * @param token - 当前 BullMQ 任务的唯一租约令牌。
   * @returns 成功获得槽位时为 `true`，达到单用户上限时为 `false`。
   */
  async acquire(ownerId: string, token: string) {
    const now = Date.now();
    const result = await this.connection.eval(
      ACQUIRE_SLOT_SCRIPT,
      1,
      this.key(ownerId),
      now,
      now + this.leaseMs,
      token,
      this.slotLimit,
      this.leaseMs * 2,
    );
    return Number(result) === 1;
  }

  /**
   * 延长仍在执行任务的用户槽位租约。
   *
   * @param ownerId - 任务所属用户。
   * @param token - 获取槽位时使用的租约令牌。
   * @returns 租约仍存在时为 `true`。
   */
  async renew(ownerId: string, token: string) {
    const result = await this.connection.eval(
      RENEW_SLOT_SCRIPT,
      1,
      this.key(ownerId),
      token,
      Date.now() + this.leaseMs,
      this.leaseMs * 2,
    );
    return Number(result) === 1;
  }

  /**
   * 任务结束后释放用户执行槽位。
   *
   * @param ownerId - 任务所属用户。
   * @param token - 获取槽位时使用的租约令牌。
   */
  async release(ownerId: string, token: string) {
    await this.connection.zrem(this.key(ownerId), token);
  }

  /** 关闭专用 Redis 连接。 */
  async close() {
    await this.connection.quit();
  }

  private key(ownerId: string) {
    return `${this.keyPrefix}:${ownerId}`;
  }

  private readPositiveInteger(raw: string | undefined, fallback: number) {
    const value = Number(raw || fallback);
    return Number.isFinite(value) ? Math.max(1, Math.trunc(value)) : fallback;
  }
}
