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
        "SELECT id, name, group_id FROM keywords WHERE group_id = ? ORDER BY sort_order ASC, id ASC"
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

// POST: add a keyword to an existing group, create a new group, or reorder
export async function onRequestPost(context: { request: Request; env: Env }) {
  try {
    await requireAuth(context.env, context.request);
    const body = await context.request.json() as { action?: string; groupId?: number; name?: string; slug?: string; keywords?: string[]; orderedIds?: number[] };

    // Reorder keywords within a group (must be checked FIRST, before groupId+name)
    if (body.action === "reorder" && body.groupId && Array.isArray(body.orderedIds)) {
      for (let i = 0; i < body.orderedIds.length; i++) {
        await context.env.DB.prepare(
          "UPDATE keywords SET sort_order = ? WHERE id = ? AND group_id = ?"
        ).bind(i, body.orderedIds[i], body.groupId).run();
      }
      return Response.json({ success: true });
    }

    // Add single keyword to existing group
    if (body.groupId && body.name) {
      const name = body.name.trim();
      if (!name) return Response.json({ success: false, error: "关键词不能为空" }, { status: 400 });
      await context.env.DB.prepare(
        "INSERT INTO keywords (group_id, name, created_at) VALUES (?, ?, ?)"
      ).bind(body.groupId, name, new Date().toISOString()).run();
      return Response.json({ success: true });
    }

    // Create new group with keywords
    if (body.name && body.slug && Array.isArray(body.keywords)) {
      const g = await context.env.DB.prepare(
        "INSERT INTO keyword_groups (name, slug, description, is_parameter_group, sort_order) VALUES (?, ?, ?, 0, 999)"
      ).bind(body.name, body.slug, body.description || "", 0).run();
      const row = await context.env.DB.prepare("SELECT last_insert_rowid() as id").first() as any;
      const groupId = row.id;
      for (const kw of body.keywords) {
        if (kw && typeof kw === "string" && kw.trim()) {
          await context.env.DB.prepare(
            "INSERT INTO keywords (group_id, name, created_at) VALUES (?, ?, ?)"
          ).bind(groupId, kw.trim(), new Date().toISOString()).run();
        }
      }
      return Response.json({ success: true, data: { id: groupId } });
    }

    return Response.json({ success: false, error: "参数错误" }, { status: 400 });
  } catch (e) {
    if ((e as Error).message === "Unauthorized") return Response.json({ success: false, error: "未登录" }, { status: 401 });
    return Response.json({ success: false, error: "创建失败" }, { status: 500 });
  }
}

export async function onRequestPut(context: { request: Request; env: Env }) {
  try {
    await requireAuth(context.env, context.request);
    const body = await context.request.json() as { action?: string; group_id?: number; name?: string; id?: number; keywords?: string[] };
    
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

    // Update group name and keywords
    if (body.id && body.name) {
      await context.env.DB.prepare("UPDATE keyword_groups SET name = ? WHERE id = ?").bind(body.name, body.id).run();
      if (Array.isArray(body.keywords)) {
        await context.env.DB.prepare("DELETE FROM keywords WHERE group_id = ?").bind(body.id).run();
        for (const kw of body.keywords) {
          if (kw && typeof kw === "string" && kw.trim()) {
            await context.env.DB.prepare(
              "INSERT INTO keywords (group_id, name, created_at) VALUES (?, ?, ?)"
            ).bind(body.id, kw.trim(), new Date().toISOString()).run();
          }
        }
      }
      return Response.json({ success: true });
    }

    return Response.json({ success: false, error: "未知操作" }, { status: 400 });
  } catch (e) {
    if ((e as Error).message === "Unauthorized") return Response.json({ success: false, error: "未登录" }, { status: 401 });
    return Response.json({ success: false, error: "操作失败" }, { status: 500 });
  }
}

// DELETE: delete a single keyword (by keyword id) or a whole group (by group id with ?group=X)
export async function onRequestDelete(context: { request: Request; env: Env }) {
  try {
    await requireAuth(context.env, context.request);
    const url = new URL(context.request.url);
    const id = url.searchParams.get("id");
    const groupId = url.searchParams.get("group");
    
    if (groupId) {
      // Delete entire group and its keywords
      await context.env.DB.prepare("DELETE FROM keywords WHERE group_id = ?").bind(parseInt(groupId)).run();
      await context.env.DB.prepare("DELETE FROM keyword_groups WHERE id = ?").bind(parseInt(groupId)).run();
      return Response.json({ success: true });
    }
    
    if (id) {
      // Delete single keyword
      await context.env.DB.prepare("DELETE FROM keywords WHERE id = ?").bind(parseInt(id)).run();
      return Response.json({ success: true });
    }
    
    return Response.json({ success: false, error: "缺少ID" }, { status: 400 });
  } catch (e) {
    if ((e as Error).message === "Unauthorized") return Response.json({ success: false, error: "未登录" }, { status: 401 });
    return Response.json({ success: false, error: "删除失败" }, { status: 500 });
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: { Allow: "GET, POST, PUT, DELETE, OPTIONS" } });
}

