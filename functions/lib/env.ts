import { HttpError } from "./http";
import { loadSettings } from "./settings";

/**
 * 配置只有两个来源，一个值只属于其中一个：
 *
 *   环境变量  进门用的东西——ACCESS_PASSWORD，以及可选的 SESSION_SECRET。
 *             它们必须在「能打开设置页」之前就存在，所以放环境变量。
 *    D1 设置  其余全部业务配置（模型接口、图床、提示词），登录后在设置页里改。
 *
 * 不做「环境变量优先、库里兜底」那种多层回退：一个值从哪来是确定的，
 * 省得改了半天不知道被哪一层盖住。
 */

export interface Env {
  DB: D1Database;
  IMAGES_BUCKET: R2Bucket;
  TASK_QUEUE: Queue;

  /** 唯一必填的环境变量 */
  ACCESS_PASSWORD: string;
  /** 可选：不配则首次使用时生成一条存进 D1 */
  SESSION_SECRET?: string;
}

export const DEFAULT_IMAGE_PROMPT = `你是一位顶尖的创意导演和商业摄影师，擅长从关键词卡片生成有氛围感、有随机惊喜的画面描述。你的任务是根据用户选择的分类关键词，生成一段可直接用于生图的中文提示词。

核心规则：
1. 纯中文输出：只输出一段通顺完整的中文画面描述。不加英文，不加"画面描述："等标题，不加任何解释、前缀。直接从描述内容开始写。
2. 包含画面主体、环境/背景、光线、风格、构图、氛围等要素。
3. 长度控制在 80-300 字之间，自然流畅，不要机械分段。
4. 安全准则：用衣物配饰自然覆盖身体，用光影和构图引导视线，避免写裸体/透视/暗示性内容。`;

export const DEFAULT_POLISH_PROMPT = `你是一位专业的画面描述优化师。润色中文画面描述：更丰富、更有氛围感、更文学化。纯中文输出，一段话写完，不要机械分段。保持原意，增强画面感和细节描写。`;

export interface AppConfig {
  llmEndpoint: string;
  llmApiKey: string;
  llmModel: string;
  imageEndpoint: string;
  imageApiKey: string;
  imageModel: string;
  imageBedEndpoint: string;
  imageBedAuthCode: string;
  imageBedChannel: string;
  promptSystemImage: string;
  promptSystemPolish: string;
}

/** 提示词没填就用内置那份，其余字段空着就是空着（缺了会明确报错）。 */
export async function loadConfig(env: Env): Promise<AppConfig> {
  const s = await loadSettings(env);
  return {
    llmEndpoint: s.llm_endpoint ?? "",
    llmApiKey: s.llm_api_key ?? "",
    llmModel: s.llm_model ?? "",
    imageEndpoint: s.image_endpoint ?? "",
    imageApiKey: s.image_api_key ?? "",
    imageModel: s.image_model ?? "",
    imageBedEndpoint: s.image_bed_endpoint ?? "",
    imageBedAuthCode: s.image_bed_auth_code ?? "",
    imageBedChannel: s.image_bed_channel ?? "",
    promptSystemImage: s.prompt_system_image?.trim() || DEFAULT_IMAGE_PROMPT,
    promptSystemPolish: s.prompt_system_polish?.trim() || DEFAULT_POLISH_PROMPT,
  };
}

/** 出图必需但还没填的项 */
export function missingConfig(config: AppConfig): string[] {
  const required: [string, string][] = [
    ["llm_endpoint", config.llmEndpoint],
    ["llm_api_key", config.llmApiKey],
    ["llm_model", config.llmModel],
    ["image_endpoint", config.imageEndpoint],
    ["image_api_key", config.imageApiKey],
    ["image_model", config.imageModel],
  ];
  return required.filter(([, value]) => !value).map(([key]) => key);
}

/** 生成结果存哪里：配了图床走外链，否则存 R2 经 /api/images 代理 */
export function storageMode(config: AppConfig): "image-bed" | "r2" {
  return config.imageBedEndpoint ? "image-bed" : "r2";
}

function require_(label: string, values: string[]): void {
  if (values.some((value) => !value))
    throw new HttpError(500, `缺少配置：${label}（到设置页填写）`);
}

export interface ImageSettings {
  endpoint: string;
  apiKey: string;
  model: string;
}

export function getImageSettings(config: AppConfig): ImageSettings {
  require_("图像接口", [
    config.imageEndpoint,
    config.imageApiKey,
    config.imageModel,
  ]);
  return {
    endpoint: config.imageEndpoint,
    apiKey: config.imageApiKey,
    model: config.imageModel,
  };
}

export interface LlmSettings {
  endpoint: string;
  apiKey: string;
  model: string;
  promptSystemImage: string;
  promptSystemPolish: string;
}

export function getLlmSettings(config: AppConfig): LlmSettings {
  require_("LLM 接口", [config.llmEndpoint, config.llmApiKey, config.llmModel]);
  return {
    endpoint: config.llmEndpoint,
    apiKey: config.llmApiKey,
    model: config.llmModel,
    promptSystemImage: config.promptSystemImage,
    promptSystemPolish: config.promptSystemPolish,
  };
}

export interface ImageBedSettings {
  endpoint: string;
  authCode: string;
  channel: string;
}

/** 没配图床返回 null，调用方回退 R2。 */
export function getImageBedSettings(config: AppConfig): ImageBedSettings | null {
  if (!config.imageBedEndpoint) return null;
  return {
    endpoint: config.imageBedEndpoint.replace(/\/+$/, ""),
    authCode: config.imageBedAuthCode,
    channel: config.imageBedChannel,
  };
}
