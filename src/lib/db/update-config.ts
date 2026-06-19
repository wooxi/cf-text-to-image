import Database from "better-sqlite3";
import path from "path";

const sqlite = new Database(path.join(process.cwd(), "data", "text-to-image.db"));

const configs: Record<string, string> = {
  llm_endpoint: process.env.LLM_ENDPOINT || "https://api.openai.com/v1",
  llm_api_key: process.env.LLM_API_KEY || "",
  llm_model: process.env.LLM_MODEL || "gpt-4o",
  image_provider: process.env.IMAGE_PROVIDER || "openai_image",
  image_endpoint: process.env.IMAGE_ENDPOINT || "https://api.openai.com/v1",
  image_api_key: process.env.IMAGE_API_KEY || "",
  image_model: process.env.IMAGE_MODEL || "gpt-image-1",
  image_size: process.env.IMAGE_SIZE || "1024x1024",
  video_provider: process.env.VIDEO_PROVIDER || "agnes_video",
  video_endpoint: process.env.VIDEO_ENDPOINT || "https://apihub.agnes-ai.com",
  video_api_key: process.env.VIDEO_API_KEY || "",
  video_model: process.env.VIDEO_MODEL || "agnes-video-v2.0",
};

const upsert = sqlite.prepare(
  "INSERT INTO config (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at"
);

for (const [key, value] of Object.entries(configs)) {
  upsert.run(key, value);
}

console.log("数据库配置已更新:");
for (const [key, value] of Object.entries(configs)) {
  const displayVal = key.includes("key") && value ? `${value.slice(0, 8)}...` : value || "<empty>";
  console.log(`  ${key}: ${displayVal}`);
}

sqlite.close();
