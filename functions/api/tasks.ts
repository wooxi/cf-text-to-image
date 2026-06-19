import { requireAuth } from "../auth";
import type { Env } from "../db";

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
    return Response.json({ success: true, data: result.results });
  } catch (e) {
    if ((e as Error).message === "Unauthorized") {
      return Response.json({ success: false, error: "未登录" }, { status: 401 });
    }
    return Response.json({ success: false, error: "获取任务失败" }, { status: 500 });
  }
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  try {
    await requireAuth(context.env, context.request);
    const body = await context.json() as Record<string, any>;
    const now = new Date().toISOString();

    const result = await context.env.DB.prepare(
      `INSERT INTO tasks (status, type, keyword_names, prompt, size, reference_image, 
       video_mode, progress, created_at, updated_at)
       VALUES ('pending', ?, ?, ?, ?, ?, ?, 0, ?, ?)`
    ).bind(
      body.type || "image",
      body.keywords || "",
      body.prompt || "",
      body.size || "1024x1024",
      Array.isArray(body.image) ? body.image.join(",") : (body.image || ""),
      body.video_mode || "reference",
      now, now
    ).run();

    return Response.json({
      success: true,
      data: { taskId: result.meta.last_row_id }
    });
  } catch (e) {
    if ((e as Error).message === "Unauthorized") {
      return Response.json({ success: false, error: "未登录" }, { status: 401 });
    }
    return Response.json({ success: false, error: "创建任务失败" }, { status: 500 });
  }
}

export async function onRequestDelete(context: { request: Request; env: Env }) {
  try {
    await requireAuth(context.env, context.request);
    const url = new URL(context.request.url);
    const id = url.searchParams.get("id");
    if (!id) return Response.json({ success: false, error: "缺少ID" }, { status: 400 });

    await context.env.DB.prepare("DELETE FROM tasks WHERE id = ?").bind(parseInt(id)).run();
    return Response.json({ success: true });
  } catch (e) {
    if ((e as Error).message === "Unauthorized") {
      return Response.json({ success: false, error: "未登录" }, { status: 401 });
    }
    return Response.json({ success: false, error: "删除失败" }, { status: 500 });
  }
}

export async function onRequestPut(context: { request: Request; env: Env }) {
  try {
    await requireAuth(context.env, context.request);
    const body = await context.json() as { id?: number };
    if (!body.id) return Response.json({ success: false, error: "缺少ID" }, { status: 400 });

    const now = new Date().toISOString();
    await context.env.DB.prepare(
      "UPDATE tasks SET status = 'pending', progress = 0, error = '', updated_at = ? WHERE id = ?"
    ).bind(now, body.id).run();
    return Response.json({ success: true });
  } catch (e) {
    if ((e as Error).message === "Unauthorized") {
      return Response.json({ success: false, error: "未登录" }, { status: 401 });
    }
    return Response.json({ success: false, error: "重试失败" }, { status: 500 });
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: { Allow: "GET, POST, PUT, DELETE, OPTIONS" } });
}
