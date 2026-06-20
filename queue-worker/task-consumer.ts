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
      size: batch.messages.length,
      ids: batch.messages.map((message) => Number(message.body?.taskId || 0)).filter(Boolean),
    });

    await Promise.all(batch.messages.map(async (message) => {
      const taskId = Number(message.body?.taskId || 0);
      if (!taskId) {
        logConsumer("skip-invalid", { body: message.body || null });
        message.ack();
        return;
      }

      try {
        logConsumer("task-start", { taskId });
        await processTaskById(env, taskId);
        logConsumer("task-finish", { taskId });
      } catch (error) {
        const messageText = error instanceof Error ? error.message : String(error || "unknown error");
        logConsumer("task-error", { taskId, error: messageText });
      }

      message.ack();
    }));

    logConsumer("batch-finish", { size: batch.messages.length });
  },
};
