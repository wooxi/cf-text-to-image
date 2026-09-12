import type { Env } from "./env";

/**
 * 应用内可编辑的配置，存在 D1 的 settings 表里（老库由 0002_settings 迁移建表）。
 *
 * 密钥写进这张表之后不会再回传给前端：读取接口只回「是否已设置」，
 * 前端输入框留空即表示「不修改」。
 */

/** 这些键的值不回传，只回布尔 */
export const SECRET_KEYS = new Set([
  "llm_api_key",
  "image_api_key",
  "image_bed_auth_code",
]);

/** 可写白名单：不在这份名单里的键一律拒收 */
export const EDITABLE_KEYS = [
  "llm_endpoint",
  "llm_api_key",
  "llm_model",
  "image_endpoint",
  "image_api_key",
  "image_model",
  "image_bed_endpoint",
  "image_bed_auth_code",
  "image_bed_channel",
  "prompt_system_image",
  "prompt_system_polish",
] as const;

export type EditableKey = (typeof EDITABLE_KEYS)[number];

export type SettingsMap = Record<string, string>;

/** 读全部设置。表还不存在（没跑过迁移）时返回空表，而不是让整个请求 500。 */
export async function loadSettings(env: Env): Promise<SettingsMap> {
  try {
    const { results } = await env.DB.prepare(
      "SELECT key, value FROM settings",
    ).all<{ key: string; value: string }>();
    const map: SettingsMap = {};
    for (const row of results) map[row.key] = row.value;
    return map;
  } catch {
    return {};
  }
}

/** 写入若干设置。空字符串表示清除该项（回到默认/环境变量）。 */
export async function saveSettings(
  env: Env,
  entries: Record<string, string>,
): Promise<void> {
  const now = new Date().toISOString();
  const statements = Object.entries(entries).map(([key, value]) =>
    value === ""
      ? env.DB.prepare("DELETE FROM settings WHERE key = ?").bind(key)
      : env.DB.prepare(
          "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) " +
            "ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
        ).bind(key, value, now),
  );
  if (statements.length) await env.DB.batch(statements);
}

/**
 * 会话签名密钥：环境变量优先，其次库里的；都没有就生成一条写库。
 *
 * 生成时用 INSERT ... ON CONFLICT DO NOTHING 再回读，保证并发首次请求
 * 不会各写一份、把对方刚发的会话弄失效。
 */
export async function sessionSecret(env: Env): Promise<string> {
  const fromEnv = env.SESSION_SECRET?.trim();
  if (fromEnv && fromEnv.length >= 16) return fromEnv;

  const existing = (await loadSettings(env)).session_secret;
  if (existing && existing.length >= 16) return existing;

  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const generated = [...bytes]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  try {
    await env.DB.prepare(
      "INSERT INTO settings (key, value, updated_at) VALUES ('session_secret', ?, ?) " +
        "ON CONFLICT(key) DO NOTHING",
    )
      .bind(generated, new Date().toISOString())
      .run();
  } catch {
    // 表还没有就先用手上这份，下一次请求再落库
    return generated;
  }
  return (await loadSettings(env)).session_secret || generated;
}
