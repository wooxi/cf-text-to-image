import { requireAuth } from "../auth";
import type { Env } from "../db";

const SECRET_KEYS = ["llm_api_key", "image_api_key", "video_api_key"];

/** Get API key: env var first, fallback to D1 config table */
export async function getApiKey(env: Env, keyName: string): Promise<string> {
  // 1. Try CF environment variable (encrypted secret)
  const envVal = (env as any)[keyName.toUpperCase()];
  if (envVal) return envVal;

  // 2. Fallback to D1 config table
  try {
    const row = await env.DB.prepare(
      "SELECT value FROM config WHERE key = ?"
    ).bind(keyName).first<{ value: string }>();
    if (row?.value) return row.value;
  } catch {}

  return "";
}

export async function onRequestGet(context: { request: Request; env: Env }) {
  try {
    await requireAuth(context.env, context.request);
    const configs = await context.env.DB.prepare(
      "SELECT key, value, is_secret FROM config"
    ).all();

    const map: Record<string, string> = {};
    for (const row of configs.results) {
      const r = row as any;
      if (r.is_secret || SECRET_KEYS.includes(r.key)) {
        const val = await getApiKey(context.env, r.key);
        map[r.key] = val ? "••••••••（已设置）" : "未设置";
      } else {
        map[r.key] = r.value || "";
      }
    }

    // Also check keys not yet in DB
    for (const key of SECRET_KEYS) {
      if (!(key in map)) {
        const val = await getApiKey(context.env, key);
        map[key] = val ? "••••••••（已设置）" : "未设置";
      }
    }

    return Response.json({ success: true, data: map });
  } catch (e) {
    if ((e as Error).message === "Unauthorized") {
      return Response.json({ success: false, error: "未登录" }, { status: 401 });
    }
    return Response.json({ success: false, error: "获取配置失败" }, { status: 500 });
  }
}

export async function onRequestPut(context: { request: Request; env: Env }) {
  try {
    await requireAuth(context.env, context.request);
    const body = await context.json() as Record<string, string>;

    for (const [key, value] of Object.entries(body)) {
      if (typeof value !== "string") continue;
      const isSecret = SECRET_KEYS.includes(key) ? 1 : 0;

      const existing = await context.env.DB.prepare(
        "SELECT id FROM config WHERE key = ?"
      ).bind(key).first();
      const now = new Date().toISOString();

      if (existing) {
        await context.env.DB.prepare(
          "UPDATE config SET value = ?, is_secret = ?, updated_at = ? WHERE key = ?"
        ).bind(value, isSecret, now, key).run();
      } else {
        await context.env.DB.prepare(
          "INSERT INTO config (key, value, is_secret, updated_at) VALUES (?, ?, ?, ?)"
        ).bind(key, value, isSecret, now).run();
      }
    }

    return Response.json({ success: true });
  } catch (e) {
    if ((e as Error).message === "Unauthorized") {
      return Response.json({ success: false, error: "未登录" }, { status: 401 });
    }
    return Response.json({ success: false, error: "保存失败" }, { status: 500 });
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: { Allow: "GET, PUT, OPTIONS" } });
}
