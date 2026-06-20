import { processTaskById } from "../functions/task-processing";
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
      ids: batch.messages.map((message) => Number(message.body?.taskId || 0)).filter(Boolean),
    });

    for (const message of batch.messages) {
      const taskId = Number(message.body?.taskId || 0);
      if (!taskId) {
        logConsumer("skip-invalid", { queue: batch.queue, body: message.body || null });
        message.ack();
        continue;
      }

      try {
        logConsumer("task-start", { queue: batch.queue, taskId });
        await processTaskById(env, taskId);
        logConsumer("task-finish", { queue: batch.queue, taskId });
      } catch (error) {
        const messageText = error instanceof Error ? error.message : String(error || "unknown error");
        logConsumer("task-error", { queue: batch.queue, taskId, error: messageText });
      }

      message.ack();
    }

    logConsumer("batch-finish", { queue: batch.queue, size: batch.messages.length });
  },
};
