import { HttpError } from "./http";

/**
 * 所有配置（含密钥）一律来自 Cloudflare 环境变量，不落库、不在系统内编辑。
 * 见 README「环境变量」。
 *
 * 生成结果的落盘位置由 IMAGE_BED_* 决定：配了图床就走图床外链，没配就走 R2。
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
  | "IMAGE_BED_ENDPOINT"
  | "IMAGE_BED_AUTH_CODE"
  | "IMAGE_BED_CHANNEL"
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

  /**
   * 可选：CloudFlare-ImgBed 图床。配了就把生成结果传图床、以外部链接入库，
   * R2 只留给参考图；没配则和以前一样存 R2。
   */
  IMAGE_BED_ENDPOINT?: string;
  IMAGE_BED_AUTH_CODE?: string;
  IMAGE_BED_CHANNEL?: string;

  /**
   * 可选：覆写内置系统提示词。短文本可以直接放这里；
   * 超过 5.1 KB 的请写进 D1 的 settings 表（键 prompt_system_image / prompt_system_polish）。
   */
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

/** 可选变量：不配也能跑（生成结果落 R2），配了才走图床。 */
export const OPTIONAL_ENV_VARS: readonly { key: ConfigKey; scope: string }[] = [
  { key: "IMAGE_BED_ENDPOINT", scope: "Pages + Worker" },
  { key: "IMAGE_BED_AUTH_CODE", scope: "Pages + Worker" },
  { key: "IMAGE_BED_CHANNEL", scope: "Pages + Worker" },
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
/**
 * 覆写提示词的取值顺序：环境变量 → D1 settings 表 → 内置默认。
 *
 * 之所以要有 D1 这一层：Worker 的单个文本绑定上限 5.1 KB，而一份认真写过的
 * 图片提示词轻易就超过它（本项目线上那份 2.8 千字，UTF-8 下 7.8 KB）。这类
 * 「内容型」配置放不进环境变量，也不该写死在代码里——每个部署者都不一样。
 * 机密（API Key、访问密码）仍然一律走环境变量，不入库。
 */
const PROMPT_KEYS = {
  PROMPT_SYSTEM_IMAGE: "prompt_system_image",
  PROMPT_SYSTEM_POLISH: "prompt_system_polish",
} as const;

async function promptOverride(
  env: Env,
  envKey: keyof typeof PROMPT_KEYS,
): Promise<string> {
  const fromEnv = env[envKey]?.trim();
  if (fromEnv) return fromEnv;
  try {
    const row = await env.DB.prepare("SELECT value FROM settings WHERE key = ?")
      .bind(PROMPT_KEYS[envKey])
      .first<{ value: string }>();
    return row?.value?.trim() ?? "";
  } catch {
    // settings 表还没建（没跑过迁移的老库）：当作没有覆写
    return "";
  }
}

/**
 * 解析两份提示词（环境变量 → D1 → 内置默认）。
 * 不校验 LLM_* 是否齐全——设置页自检要在配置不全的情况下也能把当前状态显示出来。
 */
export async function resolvePrompts(
  env: Env,
): Promise<{ image: string; polish: string }> {
  const [image, polish] = await Promise.all([
    promptOverride(env, "PROMPT_SYSTEM_IMAGE"),
    promptOverride(env, "PROMPT_SYSTEM_POLISH"),
  ]);
  return {
    image: image || DEFAULT_IMAGE_PROMPT,
    polish: polish || DEFAULT_POLISH_PROMPT,
  };
}

export async function getLlmSettings(env: Env): Promise<LlmSettings> {
  required(env, LLM_KEYS);
  const prompts = await resolvePrompts(env);
  return {
    endpoint: env.LLM_ENDPOINT.trim(),
    apiKey: env.LLM_API_KEY.trim(),
    model: env.LLM_MODEL.trim(),
    promptSystemImage: prompts.image,
    promptSystemPolish: prompts.polish,
  };
}
