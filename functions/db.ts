export interface Env {
  DB: D1Database;
  IMAGES_BUCKET: R2Bucket;
  TASK_QUEUE: Queue;
  ENABLE_REGISTRATION: string;
  JWT_SECRET: string;
}

/**
 * 一次性读取全部配置。同名的部署环境变量（大写）优先于 D1 config 表。
 */
export async function getConfigs(env: Env): Promise<Record<string, string>> {
  const { results } = await env.DB.prepare("SELECT key, value FROM config").all<{ key: string; value: string }>();
  const map: Record<string, string> = {};
  for (const row of results) {
    const envValue = (env as unknown as Record<string, unknown>)[row.key.toUpperCase()];
    map[row.key] = typeof envValue === "string" && envValue ? envValue : row.value;
  }
  return map;
}
