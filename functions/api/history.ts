import { requireAuth, HttpError, isHttpError } from "../auth";
import type { Env } from "../db";
import { deleteR2Media } from "./tasks";

function mapRecord(row: any) {
  return {
    id: row.id,
    keywordNames: row.keyword_names,
    prompt: row.prompt,
    imagePath: row.image_path,
    type: row.type,
    posterPath: row.poster_path,
    size: row.size,
    createdAt: row.created_at,
  };
}

export async function onRequestGet(context: { request: Request; env: Env }) {
  try {
    await requireAuth(context.env, context.request);
    const result = await context.env.DB.prepare(
      "SELECT id, keyword_names, prompt, image_path, type, poster_path, size, created_at FROM image_history ORDER BY created_at DESC LIMIT 200"
    ).all();
    return Response.json({ success: true, data: result.results.map(mapRecord) });
  } catch (e) {
    if (isHttpError(e)) return Response.json({ success: false, error: e.message }, { status: e.status });
    return Response.json({ success: false, error: "获取历史失败" }, { status: 500 });
  }
}

export async function onRequestDelete(context: { request: Request; env: Env }) {
  try {
    await requireAuth(context.env, context.request);
    const url = new URL(context.request.url);
    const id = Number(url.searchParams.get("id"));
    if (!id) throw new HttpError(400, "缺少ID");

    const record = await context.env.DB.prepare("SELECT image_path FROM image_history WHERE id = ?").bind(id).first<{ image_path: string }>();
    if (!record) throw new HttpError(404, "记录不存在");

    await context.env.DB.prepare("DELETE FROM image_history WHERE id = ?").bind(id).run();
    await deleteR2Media(context.env, record.image_path);
    return Response.json({ success: true });
  } catch (e) {
    if (isHttpError(e)) return Response.json({ success: false, error: e.message }, { status: e.status });
    return Response.json({ success: false, error: "删除失败" }, { status: 500 });
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: { Allow: "GET, DELETE, OPTIONS" } });
}
