import { HttpError } from "./http";

export type TaskType = "image" | "img2img";

export const MAX_PROMPT_CHARS = 4000;
export const MAX_KEYWORDS_CHARS = 2000;
export const MAX_REF_IMAGES = 3;
/** 单张参考图解码后的字节上限 */
export const MAX_REF_BYTES = 8 * 1024 * 1024;

const DATA_URI =
  /^data:(image\/(?:png|jpeg|jpg|webp|gif|avif));base64,([A-Za-z0-9+/=]+)$/i;
const SIZE = /^(\d{2,5})x(\d{2,5})$/;
const MIN_EDGE = 256;
const MAX_EDGE = 4096;

export interface ValidatedTask {
  type: TaskType;
  prompt: string;
  keywords: string;
  size: string;
  refImages: string[];
}

export function validateTaskBody(body: unknown): ValidatedTask {
  if (!body || typeof body !== "object")
    throw new HttpError(400, "请求体格式错误");
  const b = body as Record<string, unknown>;

  const type = b.type === undefined ? "image" : b.type;
  if (type !== "image" && type !== "img2img") {
    throw new HttpError(400, "不支持的任务类型");
  }

  const prompt = text(b.prompt).slice(0, MAX_PROMPT_CHARS);
  const keywords = text(b.keywords).slice(0, MAX_KEYWORDS_CHARS);
  if (!prompt && !keywords)
    throw new HttpError(400, "请至少提供提示词或关键词");

  const size = validateSize(b.size);
  const refImages = validateImages(b.image, type);

  return { type, prompt, keywords, size, refImages };
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** 只校验形状与量级，不去维护一份必须和前端保持同步的尺寸白名单。 */
function validateSize(value: unknown): string {
  const size = text(value) || "1024x1024";
  const match = size.match(SIZE);
  if (!match) throw new HttpError(400, "尺寸格式应为 1024x1024");
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (
    width < MIN_EDGE ||
    height < MIN_EDGE ||
    width > MAX_EDGE ||
    height > MAX_EDGE
  ) {
    throw new HttpError(400, `尺寸单边需在 ${MIN_EDGE}-${MAX_EDGE} 之间`);
  }
  return `${width}x${height}`;
}

function validateImages(value: unknown, type: TaskType): string[] {
  if (value === undefined) {
    if (type === "img2img")
      throw new HttpError(400, "参考图模式至少需要一张图片");
    return [];
  }
  if (!Array.isArray(value)) throw new HttpError(400, "image 必须是数组");
  if (value.length > MAX_REF_IMAGES) {
    throw new HttpError(400, `参考图最多 ${MAX_REF_IMAGES} 张`);
  }
  for (const image of value) {
    if (typeof image !== "string") throw new HttpError(400, "参考图格式错误");
    // 只接受上传的图片：放行外链等于让上游替我们请求任意地址
    if (!image.startsWith("data:")) {
      throw new HttpError(400, "请上传图片文件，不支持外链地址");
    }
    if (!DATA_URI.test(image)) {
      throw new HttpError(400, "参考图仅支持 PNG / JPEG / WebP / GIF / AVIF");
    }
  }
  return value as string[];
}

export interface DecodedRef {
  contentType: string;
  bytes: Uint8Array;
}

export function decodeDataUri(uri: string): DecodedRef {
  const match = uri.match(DATA_URI);
  if (!match) throw new HttpError(400, "参考图 Data URI 格式不正确");

  const binary = atob(match[2]);
  if (binary.length > MAX_REF_BYTES) {
    throw new HttpError(400, `参考图不能超过 ${MAX_REF_BYTES / 1024 / 1024}MB`);
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  const declared = match[1].toLowerCase();
  return {
    contentType: declared === "image/jpg" ? "image/jpeg" : declared,
    bytes,
  };
}

export function clampLimit(
  value: string | null,
  fallback: number,
  max: number,
): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), max);
}
