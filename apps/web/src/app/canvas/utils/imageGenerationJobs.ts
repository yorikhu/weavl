import type { Asset } from "@weavl/shared";
import { studioApi } from "@/lib/studioApi";

export interface ImageGenerationJobView {
  id: string;
  model: string;
  status: "queued" | "running" | "finalizing" | "succeeded" | "failed";
  error?: string | null;
  assets?: Asset[];
}

const activePolls = new Map<string, Promise<ImageGenerationJobView>>();

/** 等待指定毫秒数，不阻塞浏览器主线程。 */
function delay(milliseconds: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));
}

/**
 * 轮询图片生成任务直至完成。相同任务在多个组件中恢复时共享同一个轮询 Promise。
 *
 * @param jobId - 服务端 GenerationJob ID。
 * @returns 最终成功或失败的任务视图。
 */
export function waitForImageGeneration(jobId: string) {
  const existing = activePolls.get(jobId);
  if (existing) return existing;
  const polling = (async () => {
    const deadline = Date.now() + 15 * 60 * 1000;
    let consecutiveErrors = 0;
    while (Date.now() < deadline) {
      try {
        const job = await studioApi<ImageGenerationJobView>(`/studio/generations/image/${encodeURIComponent(jobId)}`);
        consecutiveErrors = 0;
        if (job.status === "succeeded" || job.status === "failed") return job;
      } catch (cause) {
        consecutiveErrors += 1;
        if (consecutiveErrors >= 5) throw cause;
      }
      await delay(1500);
    }
    throw new Error("图片生成等待超时，请稍后重新打开画布查看结果");
  })();
  activePolls.set(jobId, polling);
  void polling.finally(() => activePolls.delete(jobId)).catch(() => undefined);
  return polling;
}
