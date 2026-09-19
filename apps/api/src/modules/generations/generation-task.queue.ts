import { Injectable, OnApplicationShutdown } from "@nestjs/common";
import { Queue } from "bullmq";
import Redis from "ioredis";

export const GENERATION_TASK_QUEUE = "generation-tasks";

export type GenerationTaskKind = "text" | "image" | "video" | "audio" | "avatar" | "document" | "workflow";

export interface GenerationTaskPayload {
  jobId: string;
  kind: GenerationTaskKind;
  /** 任务所属用户；Worker 使用它实施跨实例的单用户并发限制。 */
  ownerId: string;
}

/** BullMQ 通用任务生产者，供各类内容生成和工作流长任务复用。 */
@Injectable()
export class GenerationTaskQueue implements OnApplicationShutdown {
  private readonly connection = new Redis(process.env.REDIS_URL || "redis://127.0.0.1:6379", {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  });
  private readonly queue = new Queue<GenerationTaskPayload>(GENERATION_TASK_QUEUE, {
    connection: this.connection,
    prefix: process.env.WEAVL_QUEUE_PREFIX || "weavl:queue",
  });

  /**
   * 将数据库任务放入通用生成队列；相同任务 ID 重复入队时由 BullMQ 去重。
   *
   * @param task - 任务主键和业务类型。
   * @returns BullMQ 任务。
   */
  enqueue(task: GenerationTaskPayload) {
    const kindAttempts = process.env[`WEAVL_${task.kind.toUpperCase()}_QUEUE_ATTEMPTS`];
    const fallbackAttempts = Number(process.env.WEAVL_GENERATION_QUEUE_ATTEMPTS || 2);
    const configuredAttempts = Number(kindAttempts || fallbackAttempts);
    const attempts = Number.isFinite(configuredAttempts)
      ? Math.min(5, Math.max(1, Math.trunc(configuredAttempts)))
      : fallbackAttempts;
    const configuredDelay = Number(process.env.WEAVL_GENERATION_QUEUE_RETRY_DELAY_MS || 2000);
    const retryDelay = Number.isFinite(configuredDelay) ? Math.max(0, configuredDelay) : 2000;
    return this.queue.add(task.kind, task, {
      jobId: task.jobId,
      attempts,
      backoff: { type: "exponential", delay: retryDelay },
      removeOnComplete: { age: 24 * 60 * 60, count: 1000 },
      removeOnFail: { age: 7 * 24 * 60 * 60, count: 2000 },
    });
  }

  /** 关闭生产者连接，保证进程可以平滑退出。 */
  async onApplicationShutdown() {
    await this.queue.close();
    await this.connection.quit();
  }
}
