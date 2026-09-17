import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import { RedisService } from "../../infrastructure/cache/redis.service";

const MAX_FAILURES = positiveInteger(process.env.WEAVL_LOGIN_MAX_FAILURES, 5);
const LOCK_SECONDS = positiveInteger(process.env.WEAVL_LOGIN_LOCK_SECONDS, 5 * 60);
const LOGIN_FAILURE_KEY_PREFIX = `${process.env.WEAVL_REDIS_PREFIX || "weavl"}:auth:login-failure:`;

/**
 * 将环境变量解析为正整数，无效值使用默认值。
 *
 * @param value - 待解析的环境变量。
 * @param fallback - 无效输入时使用的默认值。
 * @returns 可安全用于计数或超时配置的正整数。
 */
function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * 生成不暴露邮箱明文的登录失败缓存键。
 *
 * @param rawEmail - 用户提交的邮箱。
 * @returns 由规范化邮箱摘要构成的缓存键。
 */
function failureKey(rawEmail: string) {
  const normalizedEmail = rawEmail.trim().toLowerCase();
  const emailHash = createHash("sha256").update(normalizedEmail).digest("hex");
  return `${LOGIN_FAILURE_KEY_PREFIX}${emailHash}`;
}

@Injectable()
export class LoginAttemptService {
  constructor(private readonly redis: RedisService) {}

  /**
   * 在校验密码前阻止仍处于锁定期的账号继续尝试。
   *
   * @param email - 用户提交的邮箱。
   * @throws {HttpException} 失败次数达到上限且锁定尚未到期时抛出 429。
   */
  async assertAllowed(email: string) {
    const key = failureKey(email);
    const [rawFailures, remainingTtlSeconds] = await Promise.all([this.redis.get(key), this.redis.ttl(key)]);
    const failures = Number(rawFailures ?? 0);
    if (failures >= MAX_FAILURES && remainingTtlSeconds > 0) {
      this.throwLocked(remainingTtlSeconds);
    }
  }

  /**
   * 记录一次密码错误，并在达到上限时立即锁定账号。
   *
   * 每次失败都会刷新计数窗口，因此第 5 次失败后可以获得完整的五分钟锁定期。
   *
   * @param email - 用户提交的邮箱。
   * @throws {HttpException} 本次失败达到上限时抛出 429。
   */
  async recordFailure(email: string) {
    const state = await this.redis.incrementWithExpiry(failureKey(email), LOCK_SECONDS);
    if (state.count >= MAX_FAILURES) this.throwLocked(state.remainingTtlSeconds);
  }

  /**
   * 登录成功后清除该账号积累的失败次数。
   *
   * @param email - 已成功登录的邮箱。
   * @returns Redis 删除操作的结果。
   */
  clear(email: string) {
    return this.redis.delete(failureKey(email));
  }

  /**
   * 构造包含剩余等待时间的限流异常。
   *
   * @param retryAfterSeconds - 锁定剩余秒数。
   * @throws {HttpException} 始终抛出 HTTP 429。
   */
  private throwLocked(retryAfterSeconds: number): never {
    const safeRetryAfterSeconds = Math.max(1, retryAfterSeconds);
    const retryAfterMinutes = Math.ceil(safeRetryAfterSeconds / 60);
    throw new HttpException(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        error: "Too Many Requests",
        message: `密码错误次数过多，请在 ${retryAfterMinutes} 分钟后重试`,
        retryAfterSeconds: safeRetryAfterSeconds,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
