import { requireAuth } from "../../auth";
import type { Env } from "../../db";

// POST /api/keywords/reorder - reorder keywords within a group
export async function onRequestPost(context: { request: Request; env: Env }) {
  try {
    await requireAuth(context.env, context.request);
    const body = await context.request.json() as { groupId?: number; orderedIds?: number[] };
    if (!body.groupId || !Array.isArray(body.orderedIds)) {
      return Response.json({ success: false, error: "参数错误" }, { status: 400 });
    }
    // Update sort_order for each keyword
    for (let i = 0; i < body.orderedIds.length; i++) {
      await context.env.DB.prepare(
        "UPDATE keywords SET sort_order = ? WHERE id = ? AND group_id = ?"
      ).bind(i, body.orderedIds[i], body.groupId).run();
    }
    return Response.json({ success: true });
  } catch (e) {
    if ((e as Error).message === "Unauthorized") return Response.json({ success: false, error: "未登录" }, { status: 401 });
    return Response.json({ success: false, error: "排序失败" }, { status: 500 });
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: { Allow: "POST, OPTIONS" } });
}

