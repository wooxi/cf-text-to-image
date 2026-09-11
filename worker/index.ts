import pagesFunctions from "../dist/functions/index.js";
import {
  processTaskById,
  runMaintenance,
  ModelApiError,
} from "../functions/task-processing";
import type { Env } from "../functions/lib/env";

/**
 * 单 Worker 应用。
 *
 *   /api/*    编译后的 Pages Functions（functions/ 目录，构建时产出 dist/functions）
 *   其余路径   静态资源绑定直出（Next.js 导出的 out/）
 *   队列消息   出图任务
 *   定时触发   每天 03:00 UTC 收尸 + 清理过期参考图
 *
 * 为什么不再是 Pages 项目：Cloudflare 的一键部署（Deploy to Cloudflare 按钮）
 * 只支持 Workers；Pages 也没有队列消费和定时触发能力，原来必须额外部署一个
 * Worker。合并成一个 Worker 之后，fork 的人在仓库点一下按钮就能部署完整的应用。
 */

interface QueueMessage {
  taskId: number;
}

function log(event: string, payload: Record<string, unknown>) {
  console.log(JSON.stringify({ scope: "worker", event, ...payload }));
}

export default {
  /** 静态资源由 assets 绑定处理；走到这里的只有 /api/*。 */
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    return pagesFunctions.fetch(request, env, ctx);
  },

  async queue(batch: MessageBatch, env: Env): Promise<void> {
    for (const message of batch.messages) {
      const taskId = Number((message.body as QueueMessage | undefined)?.taskId);
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
} satisfies ExportedHandler<Env>;
