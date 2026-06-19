import { drizzle } from "drizzle-orm/d1";

export function getDB(env: Env) {
  return drizzle(env.DB);
}

export interface Env {
  DB: D1Database;
  KV: KVNamespace;
  JWT_SECRET: string;
  ENABLE_REGISTRATION: string;
  OPENAI_API_KEY?: string;
  OPENAI_BASE_URL?: string;
  AGNES_API_KEY?: string;
  AGNES_BASE_URL?: string;
}
