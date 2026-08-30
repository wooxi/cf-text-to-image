import { requireAdmin, isHttpError } from "../auth";
import { getConfigs } from "../db";
import type { Env } from "../db";

const SECRET_KEYS = ["llm_api_key", "image_api_key", "video_api_key"];
const MASK = "••••••••（已设置）";

export async function onRequestGet(context: { request: Request; env: Env }) {
  try {
    await requireAdmin(context.env, context.request);
    const values = await getConfigs(context.env);
    const map: Record<string, string> = {};
    for (const [key, value] of Object.entries(values)) {
      map[key] = SECRET_KEYS.includes(key) ? (value ? MASK : "") : value;
    }
    return Response.json({ success: true, data: map });
  } catch (e) {
    if (isHttpError(e)) return Response.json({ success: false, error: e.message }, { status: e.status });
    return Response.json({ success: false, error: "获取配置失败" }, { status: 500 });
  }
}

export async function onRequestPut(context: { request: Request; env: Env }) {
  try {
    await requireAdmin(context.env, context.request);
    const body = await context.request.json() as Record<string, string>;
    const now = new Date().toISOString();
    const stmts: D1PreparedStatement[] = [];

    for (const [key, value] of Object.entries(body)) {
      if (typeof value !== "string" || !key) continue;
      if (value.includes("••")) continue; // 掩码占位符原样回传时跳过，不覆盖真实值
      const isSecret = SECRET_KEYS.includes(key) ? 1 : 0;
      stmts.push(
        context.env.DB.prepare(
          "INSERT INTO config (key, value, is_secret, updated_at) VALUES (?, ?, ?, ?) " +
          "ON CONFLICT(key) DO UPDATE SET value = excluded.value, is_secret = excluded.is_secret, updated_at = excluded.updated_at"
        ).bind(key, value, isSecret, now),
      );
    }

    if (stmts.length) await context.env.DB.batch(stmts);
    return Response.json({ success: true });
  } catch (e) {
    if (isHttpError(e)) return Response.json({ success: false, error: e.message }, { status: e.status });
    return Response.json({ success: false, error: "保存失败" }, { status: 500 });
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: { Allow: "GET, PUT, OPTIONS" } });
}
