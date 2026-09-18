import { Injectable } from "@nestjs/common";
import type { GenerationTaskPayload } from "./generation-task.queue";
import { ImageGenerationService } from "./image-generation.service";

/** 将通用队列任务分发给各媒体类型的业务处理器。 */
@Injectable()
export class GenerationTaskDispatcher {
  constructor(private readonly images: ImageGenerationService) {}

  /**
   * 执行一条通用生成任务。
   * 新媒体类型只需在此注册处理器，无需改变 BullMQ 连接和 Worker 生命周期。
   *
   * @param task - 任务主键及业务类型。
   */
  dispatch(task: GenerationTaskPayload) {
    if (task.kind === "image") return this.images.process(task.jobId);
    // TODO(generation-queue): 文本、视频、音频、数字人、文档和工作流长任务启用后注册对应处理器。
    throw new Error(`暂不支持的生成任务类型：${task.kind}`);
  }

  /**
   * 将一次队列失败交给对应业务处理器，完成状态记录、重试或退款。
   *
   * @param task - 失败任务。
   * @param message - 标准化错误信息。
   * @param finalAttempt - 是否已耗尽队列重试次数。
   */
  recordFailure(task: GenerationTaskPayload, message: string, finalAttempt: boolean) {
    if (task.kind === "image") return this.images.recordAttemptFailure(task.jobId, message, finalAttempt);
    return Promise.resolve();
  }

  /** 返回 Worker 启动时需要重新送入队列的持久化任务。 */
  async recoverableTasks(): Promise<GenerationTaskPayload[]> {
    const imageJobs = await this.images.pendingJobs();
    return imageJobs.map((job) => ({ jobId: job.id, kind: "image", ownerId: job.ownerId }));
  }
}
