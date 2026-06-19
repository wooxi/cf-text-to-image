import { requireAuth } from "../auth";
import type { Env } from "../db";

// Sensitive keys stored as CF Secrets, not in DB
const SECRET_KEYS = [
  "image_api_key", "llm_api_key", "agnes_api_key",
  "openai_api_key", "openai_base_url",
];

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
        // Don't expose the actual value, just show if set
        const envVal = (context.env as any)[r.key.toUpperCase()] || "";
        map[r.key] = envVal ? "••••••••（已设置）" : "未设置";
      } else {
        map[r.key] = r.value || "";
      }
    }

    // Also check env-only secrets
    for (const key of SECRET_KEYS) {
      if (!(key in map)) {
        const envVal = (context.env as any)[key.toUpperCase()];
        map[key] = envVal ? "••••••••（已设置）" : "未设置";
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
      // Never save secret keys through the admin UI
      if (SECRET_KEYS.includes(key)) continue;

      const existing = await context.env.DB.prepare(
        "SELECT id FROM config WHERE key = ?"
      ).bind(key).first();
      const now = new Date().toISOString();

      if (existing) {
        await context.env.DB.prepare(
          "UPDATE config SET value = ?, updated_at = ? WHERE key = ?"
        ).bind(value, now, key).run();
      } else {
        await context.env.DB.prepare(
          "INSERT INTO config (key, value, is_secret, updated_at) VALUES (?, ?, 0, ?)"
        ).bind(key, value, now).run();
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
