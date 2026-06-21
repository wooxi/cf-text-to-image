import { drizzle } from "drizzle-orm/d1";

export function getDB(env: Env) {
  return drizzle(env.DB);
}

interface QueueBinding {
  send(body: unknown, options?: { contentType?: string; delaySeconds?: number }): Promise<void>;
}

export interface Env {
  DB: D1Database;
  IMAGES_BUCKET: R2Bucket;
  TASK_QUEUE?: QueueBinding;
  ENABLE_REGISTRATION: string;
  JWT_SECRET?: string;
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

export async function getApiKey(env: Env, keyName: string): Promise<string> {
  const envVal = (env as any)[keyName.toUpperCase()];
  if (envVal) return envVal;
  try {
    const row = await env.DB.prepare("SELECT value FROM config WHERE key = ?").bind(keyName).first();
    if (row && (row as any).value) return (row as any).value;
  } catch {}
  return "";
}

export async function getConfig(env: Env, keyName: string, defaultVal: string): Promise<string> {
  const envVal = (env as any)[keyName.toUpperCase()];
  if (envVal) return envVal;
  try {
    const row = await env.DB.prepare("SELECT value FROM config WHERE key = ?").bind(keyName).first();
    if (row && (row as any).value) return (row as any).value;
  } catch {}
  return defaultVal;
}
