import { requireAuth } from "../auth";
import type { Env } from "../db";
import { processTaskById } from "../task-processing";

function mapTask(row: any) {
  return {
    id: row.id,
    status: row.status,
    type: row.type || "image",
    keywordNames: row.keyword_names || "",
    prompt: row.prompt || "",
    imagePath: row.image_path || "",
    videoPath: row.video_path || "",
    posterPath: row.poster_path || "",
    size: row.size || "",
    progress: row.progress || 0,
    error: row.error || "",
    referenceImage: row.reference_image || "",
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || "",
  };
}

function pickQueue(env: Env, taskId: number) {
  return taskId % 2 === 0 ? env.TASK_QUEUE_A : env.TASK_QUEUE_B;
}

async function enqueueTask(env: Env, taskId: number) {
  const queue = pickQueue(env, taskId);
  if (queue) {
    await queue.send({ taskId }, { contentType: "json" });
    return;
  }
  await processTaskById(env, taskId);
}

export async function onRequestGet(context: { request: Request; env: Env }) {
  try {
    await requireAuth(context.env, context.request);
    const url = new URL(context.request.url);
    const statusFilter = url.searchParams.get("status") || "";
    let query = "SELECT * FROM tasks";
    const params: any[] = [];
    if (statusFilter) {
      const statuses = statusFilter.split(",");
      query += " WHERE status IN (" + statuses.map(() => "?").join(",") + ")";
      params.push(...statuses);
    }
    query += " ORDER BY created_at DESC LIMIT 50";
    const result = await context.env.DB.prepare(query).bind(...params).all();
    return Response.json({ success: true, data: result.results.map(mapTask) });
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return Response.json({ success: false, error: "未登录" }, { status: 401 });
    }
    return Response.json({ success: false, error: "获取任务失败" }, { status: 500 });
  }
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  try {
    await requireAuth(context.env, context.request);
    const body = await context.request.json() as Record<string, any>;
    const now = new Date().toISOString();
    const type = body.type || "image";
    const prompt = body.prompt || "";
    const keywords = body.keywords || "";
    const size = body.size || "1024x1024";
    const referenceImage = Array.isArray(body.image) ? body.image.join(",") : (body.image || "");
    const requestJson = JSON.stringify(body);

    await context.env.DB.prepare(
      "INSERT INTO tasks (status, type, keyword_names, prompt, size, reference_image, request_json, progress, created_at, updated_at) VALUES ('pending', ?, ?, ?, ?, ?, ?, 0, ?, ?)"
    ).bind(type, keywords, prompt, size, referenceImage, requestJson, now, now).run();

    const lastRow = await context.env.DB.prepare("SELECT last_insert_rowid() as id").first();
    const taskId = Number((lastRow as any)?.id || 0);

    if (!taskId) {
      return Response.json({ success: false, error: "创建任务失败" }, { status: 500 });
    }

    try {
      await enqueueTask(context.env, taskId);
    } catch (error) {
      await context.env.DB.prepare(
        "UPDATE tasks SET status = 'failed', error = ?, updated_at = ? WHERE id = ?"
      ).bind((error as Error).message || "任务入队失败", new Date().toISOString(), taskId).run();
      return Response.json({ success: false, error: "任务入队失败: " + ((error as Error).message || "未知错误") }, { status: 500 });
    }

    return Response.json({ success: true, data: { taskId } });
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return Response.json({ success: false, error: "未登录" }, { status: 401 });
    }
    return Response.json({ success: false, error: "创建失败: " + ((error as Error).message || String(error)) }, { status: 500 });
  }
}

export async function onRequestDelete(context: { request: Request; env: Env }) {
  try {
    await requireAuth(context.env, context.request);
    const url = new URL(context.request.url);
    const id = url.searchParams.get("id");
    if (!id) return Response.json({ success: false, error: "缺少ID" }, { status: 400 });
    await context.env.DB.prepare("DELETE FROM tasks WHERE id = ?").bind(parseInt(id, 10)).run();
    return Response.json({ success: true });
  } catch (error) {
    if ((error as Error).message === "Unauthorized") return Response.json({ success: false, error: "未登录" }, { status: 401 });
    return Response.json({ success: false, error: "删除失败" }, { status: 500 });
  }
}

export async function onRequestPut(context: { request: Request; env: Env }) {
  try {
    await requireAuth(context.env, context.request);
    const body = await context.request.json() as { id?: number };
    if (!body.id) return Response.json({ success: false, error: "缺少ID" }, { status: 400 });

    const task = await context.env.DB.prepare("SELECT id FROM tasks WHERE id = ?").bind(body.id).first();
    if (!task) return Response.json({ success: false, error: "任务不存在" }, { status: 404 });

    const now = new Date().toISOString();
    await context.env.DB.prepare(
      "UPDATE tasks SET status = 'pending', progress = 0, error = '', image_path = '', poster_path = '', updated_at = ? WHERE id = ?"
    ).bind(now, body.id).run();

    try {
      await enqueueTask(context.env, body.id);
    } catch (error) {
      await context.env.DB.prepare(
        "UPDATE tasks SET status = 'failed', error = ?, updated_at = ? WHERE id = ?"
      ).bind((error as Error).message || "任务入队失败", new Date().toISOString(), body.id).run();
      return Response.json({ success: false, error: "重试入队失败" }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (error) {
    if ((error as Error).message === "Unauthorized") return Response.json({ success: false, error: "未登录" }, { status: 401 });
    return Response.json({ success: false, error: "重试失败" }, { status: 500 });
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: { Allow: "GET, POST, PUT, DELETE, OPTIONS" } });
}
