import type { ImageBedSettings } from "./env";
import { extForContentType } from "./media";

/**
 * CloudFlare-ImgBed 图床客户端（可选）。
 *
 * 接口契约（https://github.com/MarSeventh/CloudFlare-ImgBed）：
 *   POST {endpoint}/upload?authCode=<认证码>&returnFormat=full
 *   multipart 表单字段 file=文件二进制
 *   成功返回 JSON 数组：[{"src": "https://.../file/xxx.png"}]
 *   认证失败是 401 + 纯文本 Unauthorized（不是 JSON），所以先看状态码再解析。
 *
 * 配置了图床，生成结果就以外部链接入库，图库直接引用，不再占 R2 空间；
 * 参考图仍走 R2——那是给上游模型读字节用的，不需要外链。
 */

const UPLOAD_TIMEOUT_MS = 60_000;

/** 上传一张图，返回可公开访问的绝对地址。失败抛异常，由调用方决定回退还是判失败。 */
export async function uploadToImageBed(
  settings: ImageBedSettings,
  bytes: Uint8Array,
  contentType: string,
): Promise<string> {

  const params = new URLSearchParams({ returnFormat: "full" });
  if (settings.authCode) params.set("authCode", settings.authCode);
  if (settings.channel) params.set("uploadChannel", settings.channel);

  const ext = extForContentType(contentType) ?? "png";
  const form = new FormData();
  form.append(
    "file",
    new Blob([bytes], { type: contentType }),
    `${crypto.randomUUID()}.${ext}`,
  );

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${settings.endpoint}/upload?${params}`, {
      method: "POST",
      body: form,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`图床返回 ${response.status}: ${raw.slice(0, 200)}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`图床返回非 JSON: ${raw.slice(0, 200)}`);
  }

  const first = (Array.isArray(parsed) ? parsed[0] : parsed) as
    | { src?: string; publicUrl?: string }
    | undefined;
  const src = first?.src || first?.publicUrl;
  if (!src) throw new Error(`图床未返回地址: ${raw.slice(0, 200)}`);

  if (src.startsWith("http")) return src;
  return settings.endpoint + (src.startsWith("/") ? src : `/${src}`);
}
