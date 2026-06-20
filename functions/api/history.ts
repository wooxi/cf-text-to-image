import { requireAuth } from "../auth";
import type { Env } from "../db";

function mapRecord(row: any) {
  return {
    id: row.id,
    keywordNames: row.keyword_names || "",
    prompt: row.prompt || "",
    imagePath: row.image_path || "",
    type: row.type || "image",
    posterPath: row.poster_path || "",
    createdAt: row.created_at || "",
  };
}

export async function onRequestGet(context: { request: Request; env: Env }) {
  try {
    await requireAuth(context.env, context.request);
    const result = await context.env.DB.prepare(
      "SELECT * FROM image_history ORDER BY created_at DESC LIMIT 200"
    ).all();
    const data = result.results.map(mapRecord);
    return Response.json({ success: true, data });
  } catch (e) {
    if ((e as Error).message === "Unauthorized") {
      return Response.json({ success: false, error: "未登录" }, { status: 401 });
    }
    return Response.json({ success: false, error: "获取历史失败" }, { status: 500 });
  }
}

export async function onRequestDelete(context: { request: Request; env: Env }) {
  try {
    await requireAuth(context.env, context.request);
    const url = new URL(context.request.url);
    const id = url.searchParams.get("id");
    if (!id) return Response.json({ success: false, error: "缺少ID" }, { status: 400 });

    await context.env.DB.prepare("DELETE FROM image_history WHERE id = ?").bind(parseInt(id)).run();
    return Response.json({ success: true });
  } catch (e) {
    if ((e as Error).message === "Unauthorized") {
      return Response.json({ success: false, error: "未登录" }, { status: 401 });
    }
    return Response.json({ success: false, error: "删除失败" }, { status: 500 });
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: { Allow: "GET, DELETE, OPTIONS" } });
}
