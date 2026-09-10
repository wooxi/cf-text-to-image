import { handleError, ok, readJson, HttpError } from "../lib/http";
import type { Env } from "../lib/env";
import { requireAuth } from "../lib/auth";
import { clampLimit, decodeDataUri, validateTaskBody } from "../lib/validate";
import { extForContentType, REF_PREFIX } from "../lib/media";

const COLUMNS =
  "id, status, type, keyword_names, prompt, image_path, size, progress, error, created_at, updated_at";
const VALID_STATUS = new Set(["pending", "processing", "completed", "failed"]);

interface TaskRow {
  id: number;
  status: string;
  type: string;
  keyword_names: string;
  prompt: string;
  image_path: string;
  size: string;
  progress: number;
  error: string;
  created_at: string;
  updated_at: string;
}

function mapTask(row: TaskRow) {
  return {
    id: row.id,
    status: row.status,
    type: row.type,
    keywordNames: row.keyword_names,
    prompt: row.prompt,
    imagePath: row.image_path,
    size: row.size,
    progress: row.progress,
    error: row.error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** 参考图先落 R2：任务在队列里排队时，字节必须能活到 Worker 消费它。 */
async function storeReferencedImages(
  env: Env,
  dataUris: string[],
): Promise<string[]> {
  const keys: string[] = [];
  for (const uri of dataUris) {
    const { contentType, bytes } = decodeDataUri(uri);
    const ext = extForContentType(contentType) ?? "png";
    const key = `${REF_PREFIX}${crypto.randomUUID()}.${ext}`;
    await env.IMAGES_BUCKET.put(key, bytes, { httpMetadata: { contentType } });
    keys.push(key);
  }
  return keys;
}

export async function onRequestGet(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  try {
    await requireAuth(context.env, context.request);
    const url = new URL(context.request.url);
    const limit = clampLimit(url.searchParams.get("limit"), 50, 200);
    const statuses = (url.searchParams.get("status") || "")
      .split(",")
      .filter((status) => VALID_STATUS.has(status));

    const where = statuses.length
      ? ` WHERE status IN (${statuses.map(() => "?").join(",")})`
      : "";
    const result = await context.env.DB.prepare(
      `SELECT ${COLUMNS} FROM tasks${where} ORDER BY id DESC LIMIT ?`,
    )
      .bind(...statuses, limit)
      .all<TaskRow>();

    return ok(result.results.map(mapTask));
  } catch (e) {
    return handleError("tasks:list", e, "获取任务失败");
  }
}

export async function onRequestPost(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  try {
    await requireAuth(context.env, context.request);
    const body = validateTaskBody(await readJson<unknown>(context.request));
    const referenceKeys = await storeReferencedImages(
      context.env,
      body.refImages,
    );

    const now = new Date().toISOString();
    const inserted = await context.env.DB.prepare(
      "INSERT INTO tasks (status, type, keyword_names, prompt, size, reference_image, progress, created_at, updated_at) " +
        "VALUES ('pending', ?, ?, ?, ?, ?, 0, ?, ?)",
    )
      .bind(
        body.type,
        body.keywords,
        body.prompt || body.keywords,
        body.size,
        referenceKeys.join(","),
        now,
        now,
      )
      .run();

    const taskId = Number(inserted.meta.last_row_id);
    await context.env.TASK_QUEUE.send({ taskId }, { contentType: "json" });

    return ok({ taskId }, { status: 201 });
  } catch (e) {
    return handleError("tasks:create", e, "创建失败");
  }
}

export async function onRequestPut(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  try {
    await requireAuth(context.env, context.request);
    const { id } = await readJson<{ id?: unknown }>(context.request);
    const taskId = Number(id);
    if (!Number.isInteger(taskId) || taskId <= 0)
      throw new HttpError(400, "缺少ID");

    // 原子抢占：只有仍是 failed 的那一次调用能改到行，并发重试不会重复入队
    const claimed = await context.env.DB.prepare(
      "UPDATE tasks SET status = 'pending', progress = 0, error = '', image_path = '', updated_at = ? " +
        "WHERE id = ? AND status = 'failed'",
    )
      .bind(new Date().toISOString(), taskId)
      .run();
    if (!claimed.meta.changes)
      throw new HttpError(400, "只有失败的任务可以重试");

    await context.env.TASK_QUEUE.send({ taskId }, { contentType: "json" });
    return ok({ id: taskId });
  } catch (e) {
    return handleError("tasks:retry", e, "重试失败");
  }
}

/**
 * 删除任务记录。**不动 R2 对象**——生成结果与 image_history 指向同一个对象，
 * 在这里顺手删会让图库里的作品变成裂图。
 */
export async function onRequestDelete(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  try {
    await requireAuth(context.env, context.request);
    const taskId = Number(new URL(context.request.url).searchParams.get("id"));
    if (!Number.isInteger(taskId) || taskId <= 0)
      throw new HttpError(400, "缺少ID");

    const deleted = await context.env.DB.prepare(
      "DELETE FROM tasks WHERE id = ?",
    )
      .bind(taskId)
      .run();
    if (!deleted.meta.changes) throw new HttpError(404, "任务不存在");
    return ok({ id: taskId });
  } catch (e) {
    return handleError("tasks:delete", e, "删除失败");
  }
}
