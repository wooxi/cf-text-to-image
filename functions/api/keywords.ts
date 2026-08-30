import { requireAdmin, requireAuth, HttpError, isHttpError } from "../auth";
import type { Env } from "../db";

export async function onRequestGet(context: { request: Request; env: Env }) {
  try {
    const { results: groups } = await context.env.DB.prepare(
      "SELECT * FROM keyword_groups ORDER BY sort_order ASC, id ASC"
    ).all<any>();

    const { results: kws } = await context.env.DB.prepare(
      "SELECT id, name, group_id FROM keywords ORDER BY sort_order ASC, id ASC"
    ).all<{ id: number; name: string; group_id: number }>();

    const byGroup = new Map<number, { id: number; name: string }[]>();
    for (const kw of kws) {
      if (!byGroup.has(kw.group_id)) byGroup.set(kw.group_id, []);
      byGroup.get(kw.group_id)!.push({ id: kw.id, name: kw.name });
    }

    const data = groups.map((g) => ({
      facets: [],
      flattenedKeywords: byGroup.get(g.id) || [],
      id: g.id,
      name: g.name,
      slug: g.slug,
      description: g.description || "",
      isParameterGroup: !!g.is_parameter_group,
      keywords: byGroup.get(g.id) || [],
    }));
    return Response.json({ success: true, data });
  } catch (e) {
    return Response.json({ success: false, error: "获取关键词失败" }, { status: 500 });
  }
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  try {
    await requireAdmin(context.env, context.request);
    const body = await context.request.json() as {
      action?: string; groupId?: number; name?: string; slug?: string; description?: string; keywords?: string[]; orderedIds?: number[];
    };

    // 组内关键词重新排序
    if (body.action === "reorder") {
      if (!body.groupId || !Array.isArray(body.orderedIds)) throw new HttpError(400, "参数错误");
      const now = new Date().toISOString();
      await context.env.DB.batch(body.orderedIds.map((kwId, i) =>
        context.env.DB.prepare("UPDATE keywords SET sort_order = ? WHERE id = ? AND group_id = ?").bind(i, kwId, body.groupId)
      ));
      return Response.json({ success: true });
    }

    // 新建分组（含初始关键词）
    if (body.name && body.slug) {
      if (!Array.isArray(body.keywords)) throw new HttpError(400, "参数错误");
      const result = await context.env.DB.prepare(
        "INSERT INTO keyword_groups (name, slug, description, is_parameter_group, sort_order, created_at) VALUES (?, ?, ?, 0, 999, ?)"
      ).bind(body.name.trim(), body.slug.trim(), body.description || "", new Date().toISOString()).run();
      const groupId = result.meta.last_row_id as number;
      const now = new Date().toISOString();
      await context.env.DB.batch(body.keywords.filter((kw) => kw && kw.trim()).map((kw) =>
        context.env.DB.prepare("INSERT INTO keywords (group_id, name, created_at) VALUES (?, ?, ?)").bind(groupId, kw.trim(), now)
      ));
      return Response.json({ success: true, data: { id: groupId } });
    }

    // 向已有分组添加单个关键词
    if (body.groupId && body.name) {
      const name = body.name.trim();
      if (!name) throw new HttpError(400, "关键词不能为空");
      await context.env.DB.prepare(
        "INSERT INTO keywords (group_id, name, created_at) VALUES (?, ?, ?)"
      ).bind(body.groupId, name, new Date().toISOString()).run();
      return Response.json({ success: true });
    }

    throw new HttpError(400, "参数错误");
  } catch (e) {
    if (isHttpError(e)) return Response.json({ success: false, error: e.message }, { status: e.status });
    return Response.json({ success: false, error: "创建失败" }, { status: 500 });
  }
}

export async function onRequestPut(context: { request: Request; env: Env }) {
  try {
    await requireAdmin(context.env, context.request);
    const body = await context.request.json() as { action?: string; group_id?: number; name?: string; id?: number; keywords?: string[] };

    if (body.action === "delete") {
      if (!body.id) throw new HttpError(400, "缺少ID");
      await context.env.DB.prepare("DELETE FROM keywords WHERE id = ?").bind(body.id).run();
      return Response.json({ success: true });
    }

    if (body.action === "rename") {
      if (!body.id || !body.name) throw new HttpError(400, "缺少参数");
      await context.env.DB.prepare("UPDATE keywords SET name = ? WHERE id = ?").bind(body.name.trim(), body.id).run();
      return Response.json({ success: true });
    }

    // 更新分组：重命名 + 整体替换关键词
    if (body.id && body.name) {
      const now = new Date().toISOString();
      await context.env.DB.prepare("UPDATE keyword_groups SET name = ? WHERE id = ?").bind(body.name.trim(), body.id).run();
      if (Array.isArray(body.keywords)) {
        const names = body.keywords.filter((kw) => kw && kw.trim()).map((kw) => kw.trim());
        await context.env.DB.batch([
          context.env.DB.prepare("DELETE FROM keywords WHERE group_id = ?").bind(body.id),
          ...names.map((name) =>
            context.env.DB.prepare("INSERT INTO keywords (group_id, name, created_at) VALUES (?, ?, ?)").bind(body.id, name, now),
          ),
        ]);
      }
      return Response.json({ success: true });
    }

    throw new HttpError(400, "未知操作");
  } catch (e) {
    if (isHttpError(e)) return Response.json({ success: false, error: e.message }, { status: e.status });
    return Response.json({ success: false, error: "操作失败" }, { status: 500 });
  }
}

export async function onRequestDelete(context: { request: Request; env: Env }) {
  try {
    await requireAdmin(context.env, context.request);
    const url = new URL(context.request.url);
    const groupId = Number(url.searchParams.get("group"));
    const keywordId = Number(url.searchParams.get("id"));

    if (groupId) {
      await context.env.DB.batch([
        context.env.DB.prepare("DELETE FROM keywords WHERE group_id = ?").bind(groupId),
        context.env.DB.prepare("DELETE FROM keyword_groups WHERE id = ?").bind(groupId),
      ]);
      return Response.json({ success: true });
    }

    if (keywordId) {
      await context.env.DB.prepare("DELETE FROM keywords WHERE id = ?").bind(keywordId).run();
      return Response.json({ success: true });
    }

    throw new HttpError(400, "缺少ID");
  } catch (e) {
    if (isHttpError(e)) return Response.json({ success: false, error: e.message }, { status: e.status });
    return Response.json({ success: false, error: "删除失败" }, { status: 500 });
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: { Allow: "GET, POST, PUT, DELETE, OPTIONS" } });
}
