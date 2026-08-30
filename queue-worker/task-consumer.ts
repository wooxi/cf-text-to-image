import { processTaskById, ModelApiError } from "../functions/task-processing";
import type { Env } from "../functions/db";

interface QueueMessage {
  taskId: number;
}

function logConsumer(event: string, payload: Record<string, unknown>) {
  console.log(JSON.stringify({ scope: "queue-consumer", event, ...payload }));
}

export default {
  async queue(batch: MessageBatch<QueueMessage>, env: Env): Promise<void> {
    logConsumer("batch-start", {
      queue: batch.queue,
      size: batch.messages.length,
      ids: batch.messages.map((m) => m.body?.taskId).filter(Boolean),
    });

    for (const message of batch.messages) {
      const taskId = Number(message.body?.taskId || 0);
      if (!taskId) {
        logConsumer("skip-invalid", { body: message.body });
        message.ack();
        continue;
      }

      try {
        await processTaskById(env, taskId);
        message.ack();
      } catch (error) {
        const text = error instanceof Error ? error.message : String(error);
        if (error instanceof ModelApiError || message.attempts > 1) {
          // 预期失败或重投仍失败：终止投递，任务已在 DB 中标记 failed
          logConsumer("task-give-up", { taskId, error: text });
          message.ack();
        } else {
          // 基础设施异常（DB/存储等）：触发队列重投（max_retries = 1）
          logConsumer("task-retry", { taskId, error: text });
          message.retry();
        }
      }
    }

    logConsumer("batch-finish", { queue: batch.queue, size: batch.messages.length });
  },
};
