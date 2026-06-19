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
