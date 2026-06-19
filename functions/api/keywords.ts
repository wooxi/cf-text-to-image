import { requireAuth } from "../auth";
import type { Env } from "../db";

export async function onRequestGet(context: { request: Request; env: Env }) {
  try {
    const groups = await context.env.DB.prepare(
      "SELECT * FROM keyword_groups ORDER BY sort_order ASC, id ASC"
    ).all();

    const result = [];
    for (const group of groups.results) {
      const kws = await context.env.DB.prepare(
        "SELECT id, name, group_id FROM keywords WHERE group_id = ? ORDER BY id ASC"
      ).bind((group as any).id).all();
      result.push({
        facets: [],
        flattenedKeywords: kws.results.map((k: any) => ({ id: k.id, name: k.name })),
        id: (group as any).id,
        name: (group as any).name,
        slug: (group as any).slug,
        description: (group as any).description || "",
        isParameterGroup: !!(group as any).is_parameter_group,
        keywords: kws.results.map((k: any) => ({ id: k.id, name: k.name })),
      });
    }
    return Response.json({ success: true, data: result });
  } catch (e) {
    return Response.json({ success: false, error: "获取关键词失败" }, { status: 500 });
  }
}

export async function onRequestPut(context: { request: Request; env: Env }) {
  try {
    await requireAuth(context.env, context.request);
    const body = await context.request.json() as { action?: string; group_id?: number; name?: string; id?: number };
    
    if (body.action === "add") {
      if (!body.group_id || !body.name) return Response.json({ success: false, error: "缺少参数" }, { status: 400 });
      await context.env.DB.prepare(
        "INSERT INTO keywords (group_id, name, created_at) VALUES (?, ?, ?)"
      ).bind(body.group_id, body.name, new Date().toISOString()).run();
      return Response.json({ success: true });
    }
    
    if (body.action === "delete") {
      if (!body.id) return Response.json({ success: false, error: "缺少ID" }, { status: 400 });
      await context.env.DB.prepare("DELETE FROM keywords WHERE id = ?").bind(body.id).run();
      return Response.json({ success: true });
    }
    
    if (body.action === "rename") {
      if (!body.id || !body.name) return Response.json({ success: false, error: "缺少参数" }, { status: 400 });
      await context.env.DB.prepare("UPDATE keywords SET name = ? WHERE id = ?").bind(body.name, body.id).run();
      return Response.json({ success: true });
    }

    return Response.json({ success: false, error: "未知操作" }, { status: 400 });
  } catch (e) {
    if ((e as Error).message === "Unauthorized") return Response.json({ success: false, error: "未登录" }, { status: 401 });
    return Response.json({ success: false, error: "操作失败" }, { status: 500 });
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: { Allow: "GET, PUT, OPTIONS" } });
}
