import { Injectable, Logger, OnApplicationShutdown, OnModuleInit } from "@nestjs/common";
import { DelayedError, Job, Worker } from "bullmq";
import Redis from "ioredis";
import { GenerationTaskDispatcher } from "./generation-task.dispatcher";
import { GENERATION_TASK_QUEUE, GenerationTaskQueue, type GenerationTaskPayload } from "./generation-task.queue";
import { GenerationUserConcurrencyService } from "./generation-user-concurrency.service";

/** BullMQ 通用生成任务消费者；根据任务 kind 分发到对应业务处理器。 */
@Injectable()
export class GenerationTaskWorker implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(GenerationTaskWorker.name);
  private connection: Redis | null = null;
  private worker: Worker<GenerationTaskPayload> | null = null;

  constructor(
    private readonly dispatcher: GenerationTaskDispatcher,
    private readonly queue: GenerationTaskQueue,
    private readonly userConcurrency: GenerationUserConcurrencyService,
  ) {}

  /** 启动消费者，并把数据库中因进程退出遗留的待执行任务重新送入队列。 */
  async onModuleInit() {
    if (process.env.WEAVL_RUN_GENERATION_WORKER === "false") return;
    this.connection = new Redis(process.env.REDIS_URL || "redis://127.0.0.1:6379", {
      maxRetriesPerRequest: null,
    });
    const configuredConcurrency = Number(process.env.WEAVL_GENERATION_WORKER_CONCURRENCY || 10);
    const concurrency = Number.isFinite(configuredConcurrency) ? Math.max(1, Math.trunc(configuredConcurrency)) : 10;
    this.worker = new Worker<GenerationTaskPayload>(GENERATION_TASK_QUEUE, (job, token) => this.process(job, token), {
      connection: this.connection,
      prefix: process.env.WEAVL_QUEUE_PREFIX || "weavl:queue",
      concurrency,
    });
    this.worker.on("error", (error) => this.logger.error(error.message, error.stack));
    const recoverableTasks = await this.dispatcher.recoverableTasks();
    await Promise.all(recoverableTasks.map((task) => this.queue.enqueue(task)));
    this.logger.log(`通用生成任务 Worker 已启动，并发数 ${concurrency}`);
  }

  /**
   * 执行单个队列任务，并在最终失败时完成数据库状态更新和积分退款。
   *
   * @param job - 携带业务类型的 BullMQ 生成任务。
   */
  private async process(job: Job<GenerationTaskPayload>, workerToken?: string) {
    const ownerId = job.data.ownerId;
    const leaseToken = `${job.id || job.data.jobId}:${workerToken || "worker"}`;
    const acquired = await this.userConcurrency.acquire(ownerId, leaseToken);
    if (!acquired) {
      if (!workerToken) throw new Error("生成任务缺少 Worker 锁令牌");
      await job.moveToDelayed(Date.now() + this.userConcurrency.retryDelayMs, workerToken);
      throw new DelayedError();
    }
    let renewalPromise = Promise.resolve();
    const renewal = setInterval(() => {
      renewalPromise = renewalPromise.then(async () => {
        try {
          await this.userConcurrency.renew(ownerId, leaseToken);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.logger.warn(`用户任务槽位续期失败：${message}`);
        }
      });
    }, this.userConcurrency.renewalIntervalMs);
    renewal.unref();
    try {
      return await this.dispatcher.dispatch(job.data);
    } catch (cause) {
      const error = cause instanceof Error ? cause : new Error("生成任务失败");
      const attempts = Number(job.opts.attempts || 1);
      const finalAttempt = job.attemptsMade + 1 >= attempts;
      await this.dispatcher.recordFailure(job.data, error.message, finalAttempt);
      throw error;
    } finally {
      clearInterval(renewal);
      await renewalPromise;
      try {
        await this.userConcurrency.release(ownerId, leaseToken);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`用户任务槽位释放失败，将等待租约自动过期：${message}`);
      }
    }
  }

  /** 停止拉取新任务，等待当前任务结束并关闭 Redis 连接。 */
  async onApplicationShutdown() {
    await this.worker?.close();
    await this.userConcurrency.close();
    await this.connection?.quit();
  }
}
