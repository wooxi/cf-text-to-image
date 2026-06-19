import { drizzle } from "drizzle-orm/d1";

export function getDB(env: Env) {
  return drizzle(env.DB);
}

export interface Env {
  DB: D1Database;
  IMAGES_BUCKET: R2Bucket;
  ENABLE_REGISTRATION: string;
  LLM_ENDPOINT?: string;
  LLM_API_KEY?: string;
  LLM_MODEL?: string;
  IMAGE_ENDPOINT?: string;
  IMAGE_API_KEY?: string;
  IMAGE_MODEL?: string;
  VIDEO_ENDPOINT?: string;
  VIDEO_API_KEY?: string;
  VIDEO_MODEL?: string;
}

/** Get API key: env var first, fallback to D1 config table */
export async function getApiKey(env: Env, keyName: string): Promise<string> {
  const envVal = (env as any)[keyName.toUpperCase()];
  if (envVal) return envVal;
  try {
    const row = await env.DB.prepare(
      "SELECT value FROM config WHERE key = ?"
    ).bind(keyName).first();
    if (row && (row as any).value) return (row as any).value;
  } catch {}
  return "";
}
