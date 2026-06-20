import { processTaskById } from "../functions/task-processing";
import type { Env } from "../functions/db";

interface QueueMessage {
  taskId: number;
}

export default {
  async queue(batch: MessageBatch<QueueMessage>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      try {
        const taskId = Number(message.body?.taskId || 0);
        if (!taskId) {
          message.ack();
          continue;
        }
        await processTaskById(env, taskId);
      } catch (error) {
        console.error("queue task failed", error);
      }
      message.ack();
    }
  },
};
