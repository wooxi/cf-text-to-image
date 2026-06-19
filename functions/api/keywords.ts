import { requireAuth } from "../auth";
import type { Env } from "../db";

export async function onRequestGet(context: { request: Request; env: Env }) {
  try {
    // Keywords can be read without auth (for the UI)
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
