import {
  processTaskById,
  runMaintenance,
  ModelApiError,
} from "../functions/task-processing";
import type { Env } from "../functions/lib/env";

interface QueueMessage {
  taskId: number;
}

function log(event: string, payload: Record<string, unknown>) {
  console.log(JSON.stringify({ scope: "queue-consumer", event, ...payload }));
}

export default {
  async queue(batch: MessageBatch<QueueMessage>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      const taskId = Number(message.body?.taskId);
      if (!Number.isInteger(taskId) || taskId <= 0) {
        log("skip-invalid", { body: message.body });
        message.ack();
        continue;
      }

      try {
        await processTaskById(env, taskId);
        message.ack();
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        // 上游业务错误已落库；基础设施异常重投一次（max_retries = 1）后放弃
        if (error instanceof ModelApiError || message.attempts > 1) {
          log("task-give-up", { taskId, error: detail });
          message.ack();
        } else {
          log("task-retry", { taskId, error: detail });
          message.retry();
        }
      }
    }
  },

  async scheduled(
    _event: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    ctx.waitUntil(
      runMaintenance(env).then(
        (result) => log("maintenance-ok", result),
        (error) =>
          log("maintenance-error", {
            error: error instanceof Error ? error.message : String(error),
          }),
      ),
    );
  },
};
