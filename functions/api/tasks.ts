import { requireAuth, HttpError, isHttpError } from "../auth";
import type { Env } from "../db";
import { processTaskById } from "../task-processing";

const TASK_COLUMNS = "id, status, type, keyword_names, prompt, image_path, video_path, poster_path, size, progress, error, created_at, updated_at";
const VALID_TYPES = new Set(["image", "img2img", "video"]);
const VALID_STATUS = new Set(["pending", "processing", "completed", "failed"]);
const MAX_REF_IMAGES = 3;
const MAX_REF_IMAGE_CHARS = 3_000_000; // 每个 Data URI 上限约 2.2MB 二进制

function mapTask(row: any) {
  return {
    id: row.id,
    status: row.status,
    type: row.type,
    keywordNames: row.keyword_names,
    prompt: row.prompt,
    imagePath: row.image_path,
    videoPath: row.video_path,
    posterPath: row.poster_path,
    size: row.size,
    progress: row.progress,
    error: row.error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function validateBody(body: Record<string, any>) {
  const type = body.type || "image";
  if (!VALID_TYPES.has(type)) throw new HttpError(400, "不支持的任务类型");
  if (typeof body.prompt === "string" && body.prompt.length > 5000) throw new HttpError(400, "提示词过长");
  if (body.image !== undefined) {
    if (!Array.isArray(body.image)) throw new HttpError(400, "image 必须是数组");
    if (body.image.length > MAX_REF_IMAGES) throw new HttpError(400, `参考图最多 ${MAX_REF_IMAGES} 张`);
    for (const img of body.image) {
      if (typeof img !== "string") throw new HttpError(400, "参考图格式错误");
      if (img.startsWith("data:image/") && img.length > MAX_REF_IMAGE_CHARS) throw new HttpError(400, "参考图过大，请压缩后重试");
    }
  }
}

async function enqueueTask(env: Env, taskId: number) {
  await env.TASK_QUEUE.send({ taskId }, { contentType: "json" });
}

export async function onRequestGet(context: { request: Request; env: Env }) {
  try {
    await requireAuth(context.env, context.request);
    const url = new URL(context.request.url);
    const statusFilter = url.searchParams.get("status") || "";
    let query = "SELECT " + TASK_COLUMNS + " FROM tasks";
    const params: any[] = [];
    if (statusFilter) {
      const statuses = statusFilter.split(",").filter((s) => VALID_STATUS.has(s));
      if (!statuses.length) throw new HttpError(400, "无效的状态过滤");
      query += " WHERE status IN (" + statuses.map(() => "?").join(",") + ")";
      params.push(...statuses);
    }
    query += " ORDER BY created_at DESC LIMIT 50";
    const result = await context.env.DB.prepare(query).bind(...params).all();
    return Response.json({ success: true, data: result.results.map(mapTask) });
  } catch (e) {
    if (isHttpError(e)) return Response.json({ success: false, error: e.message }, { status: e.status });
    return Response.json({ success: false, error: "获取任务失败" }, { status: 500 });
  }
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  try {
    await requireAuth(context.env, context.request);
    const body = await context.request.json() as Record<string, any>;
    validateBody(body);

    const now = new Date().toISOString();
    const type = body.type || "image";
    const keywords = body.keywords || "";
    const prompt = body.prompt || "";
    const size = body.size || "1024x1024";
    // reference_image 列只存公网 URL；Data URI 全量放在 request_json 里供重试重放
    const referenceUrls = Array.isArray(body.image) ? body.image.filter((i: string) => !i.startsWith("data:")).join(",") : "";

    const result = await context.env.DB.prepare(
      "INSERT INTO tasks (status, type, keyword_names, prompt, size, reference_image, request_json, progress, created_at, updated_at) VALUES ('pending', ?, ?, ?, ?, ?, ?, 0, ?, ?)"
    ).bind(type, keywords, prompt, size, referenceUrls, JSON.stringify(body), now, now).run();
    const taskId = result.meta.last_row_id as number;

    try {
      await enqueueTask(context.env, taskId);
    } catch (e) {
      await context.env.DB.prepare(
        "UPDATE tasks SET status = 'failed', error = ?, updated_at = ? WHERE id = ?"
      ).bind("任务入队失败: " + (e as Error).message, now, taskId).run();
      return Response.json({ success: false, error: "任务入队失败" }, { status: 500 });
    }

    return Response.json({ success: true, data: { taskId } });
  } catch (e) {
    if (isHttpError(e)) return Response.json({ success: false, error: e.message }, { status: e.status });
    return Response.json({ success: false, error: "创建失败" }, { status: 500 });
  }
}

export async function onRequestDelete(context: { request: Request; env: Env }) {
  try {
    await requireAuth(context.env, context.request);
    const url = new URL(context.request.url);
    const id = Number(url.searchParams.get("id"));
    if (!id) throw new HttpError(400, "缺少ID");

    const task = await context.env.DB.prepare("SELECT image_path FROM tasks WHERE id = ?").bind(id).first<{ image_path: string }>();
    if (!task) throw new HttpError(404, "任务不存在");

    await context.env.DB.prepare("DELETE FROM tasks WHERE id = ?").bind(id).run();
    await deleteR2Media(context.env, task.image_path);
    return Response.json({ success: true });
  } catch (e) {
    if (isHttpError(e)) return Response.json({ success: false, error: e.message }, { status: e.status });
    return Response.json({ success: false, error: "删除失败" }, { status: 500 });
  }
}

export async function onRequestPut(context: { request: Request; env: Env }) {
  try {
    await requireAuth(context.env, context.request);
    const body = await context.request.json() as { id?: number };
    const id = Number(body.id);
    if (!id) throw new HttpError(400, "缺少ID");

    const task = await context.env.DB.prepare("SELECT status FROM tasks WHERE id = ?").bind(id).first<{ status: string }>();
    if (!task) throw new HttpError(404, "任务不存在");
    if (task.status !== "failed") throw new HttpError(400, "只有失败的任务可以重试");

    const now = new Date().toISOString();
    await context.env.DB.prepare(
      "UPDATE tasks SET status = 'pending', progress = 0, error = '', image_path = '', poster_path = '', updated_at = ? WHERE id = ? AND status = 'failed'"
    ).bind(now, id).run();

    try {
      await enqueueTask(context.env, id);
    } catch (e) {
      await context.env.DB.prepare(
        "UPDATE tasks SET status = 'failed', error = ?, updated_at = ? WHERE id = ?"
      ).bind("重试入队失败: " + (e as Error).message, now, id).run();
      return Response.json({ success: false, error: "重试入队失败" }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (e) {
    if (isHttpError(e)) return Response.json({ success: false, error: e.message }, { status: e.status });
    return Response.json({ success: false, error: "重试失败" }, { status: 500 });
  }
}

/** 删除任务/历史记录指向的 R2 媒体文件（仅本站 /api/images 路径）。 */
export async function deleteR2Media(env: Env, path: string) {
  if (!path.startsWith("/api/images?file=")) return;
  const file = path.slice("/api/images?file=".length);
  if (file && !file.includes("..")) {
    await env.IMAGES_BUCKET.delete("images/" + file);
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: { Allow: "GET, POST, PUT, DELETE, OPTIONS" } });
}
