import { HttpError } from "./http";

/**
 * 所有配置（含密钥）一律来自 Cloudflare 环境变量，不落库、不在系统内编辑。
 * 见 README「环境变量」。
 */

/** 字符串型配置项。绑定（DB / R2 / Queue）不在此列。 */
export type ConfigKey =
  | "SESSION_SECRET"
  | "ACCESS_PASSWORD"
  | "LLM_ENDPOINT"
  | "LLM_API_KEY"
  | "LLM_MODEL"
  | "IMAGE_ENDPOINT"
  | "IMAGE_API_KEY"
  | "IMAGE_MODEL"
  | "PROMPT_SYSTEM_IMAGE"
  | "PROMPT_SYSTEM_POLISH";

export interface Env {
  DB: D1Database;
  IMAGES_BUCKET: R2Bucket;
  TASK_QUEUE: Queue;

  SESSION_SECRET: string;
  ACCESS_PASSWORD: string;

  LLM_ENDPOINT: string;
  LLM_API_KEY: string;
  LLM_MODEL: string;

  IMAGE_ENDPOINT: string;
  IMAGE_API_KEY: string;
  IMAGE_MODEL: string;

  /** 可选：覆写内置系统提示词 */
  PROMPT_SYSTEM_IMAGE?: string;
  PROMPT_SYSTEM_POLISH?: string;
}

export const DEFAULT_IMAGE_PROMPT = `你是一位顶尖的创意导演和商业摄影师，擅长从关键词卡片生成有氛围感、有随机惊喜的画面描述。你的任务是根据用户选择的分类关键词，生成一段可直接用于生图的中文提示词。

核心规则：
1. 纯中文输出：只输出一段通顺完整的中文画面描述。不加英文，不加"画面描述："等标题，不加任何解释、前缀。直接从描述内容开始写。
2. 包含画面主体、环境/背景、光线、风格、构图、氛围等要素。
3. 长度控制在 80-300 字之间，自然流畅，不要机械分段。
4. 安全准则：用衣物配饰自然覆盖身体，用光影和构图引导视线，避免写裸体/透视/暗示性内容。`;

export const DEFAULT_POLISH_PROMPT = `你是一位专业的画面描述优化师。润色中文画面描述：更丰富、更有氛围感、更文学化。纯中文输出，一段话写完，不要机械分段。保持原意，增强画面感和细节描写。`;

/**
 * 按服务拆分必填项：Pages 需要鉴权与 LLM 配置，
 * 消费者 Worker 只需要图像模型配置，两边不必配置同一套变量。
 */
const AUTH_KEYS = ["SESSION_SECRET", "ACCESS_PASSWORD"] as const;
const LLM_KEYS = ["LLM_ENDPOINT", "LLM_API_KEY", "LLM_MODEL"] as const;
const IMAGE_KEYS = ["IMAGE_ENDPOINT", "IMAGE_API_KEY", "IMAGE_MODEL"] as const;

/** 供设置页自检用：全部变量，以及各自需要配置在哪个服务上。 */
export const ENV_VARS: readonly { key: ConfigKey; scope: string }[] = [
  ...AUTH_KEYS.map((key) => ({ key, scope: "Pages" })),
  ...LLM_KEYS.map((key) => ({ key, scope: "Pages" })),
  ...IMAGE_KEYS.map((key) => ({ key, scope: "Pages + Worker" })),
];

export function missingEnvVars(env: Env): string[] {
  const missing: string[] = [];
  for (const { key } of ENV_VARS) {
    if (!env[key]?.trim()) missing.push(key);
  }
  return missing;
}

function required(env: Env, keys: readonly ConfigKey[]): void {
  const missing = keys.filter((key) => !env[key]?.trim());
  if (missing.length)
    throw new HttpError(500, `缺少环境变量：${missing.join(", ")}`);
}

export interface ImageSettings {
  endpoint: string;
  apiKey: string;
  model: string;
}

/** Pages 的出图接口与消费者 Worker 都用这一份。 */
export function getImageSettings(env: Env): ImageSettings {
  required(env, IMAGE_KEYS);
  return {
    endpoint: env.IMAGE_ENDPOINT.trim(),
    apiKey: env.IMAGE_API_KEY.trim(),
    model: env.IMAGE_MODEL.trim(),
  };
}

export interface LlmSettings {
  endpoint: string;
  apiKey: string;
  model: string;
  promptSystemImage: string;
  promptSystemPolish: string;
}

/** 只有 Pages 的提示词生成 / 润色需要。 */
export function getLlmSettings(env: Env): LlmSettings {
  required(env, LLM_KEYS);
  return {
    endpoint: env.LLM_ENDPOINT.trim(),
    apiKey: env.LLM_API_KEY.trim(),
    model: env.LLM_MODEL.trim(),
    promptSystemImage: env.PROMPT_SYSTEM_IMAGE?.trim() || DEFAULT_IMAGE_PROMPT,
    promptSystemPolish:
      env.PROMPT_SYSTEM_POLISH?.trim() || DEFAULT_POLISH_PROMPT,
  };
}
