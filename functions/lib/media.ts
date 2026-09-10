import type { Env } from "./env";

/**
 * R2 布局：
 *   images/<uuid>.<ext>  生成结果，登录后经 /api/images 读取
 *   refs/<uuid>.<ext>    用户上传的参考图，只供 Worker 读字节转发给上游，从不对外暴露
 */

export const IMAGE_PREFIX = "images/";
export const REF_PREFIX = "refs/";

const EXT_BY_TYPE: Record<string, string> = {
 "image/png": "png",
 "image/jpeg": "jpg",
 "image/webp": "webp",
 "image/gif": "gif",
 "image/avif": "avif",
};

const TYPE_BY_EXT: Record<string, string> = {
 png: "image/png",
 jpg: "image/jpeg",
 webp: "image/webp",
 gif: "image/gif",
 avif: "image/avif",
};

export function extForContentType(
 contentType: string | null | undefined,
): string | null {
 if (!contentType) return null;
 return EXT_BY_TYPE[contentType.split(";")[0].trim().toLowerCase()] ?? null;
}

export function contentTypeForExt(ext: string): string {
 return TYPE_BY_EXT[ext] ?? "application/octet-stream";
}

/** 对象键与 file 参数都只允许扁平的文件名，不含路径分隔符。 */
export function isSafeKey(key: string): boolean {
 return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(key) && !key.includes("..");
}

/** 删除 image_path 指向的生成结果。非本站路径（历史外链）不处理。 */
export async function deleteImage(
 env: Env,
 imagePath: string | null | undefined,
): Promise<void> {
 const prefix = "/api/images?file=";
 if (!imagePath?.startsWith(prefix)) return;
 const file = decodeURIComponent(imagePath.slice(prefix.length));
 if (isSafeKey(file)) await env.IMAGES_BUCKET.delete(IMAGE_PREFIX + file);
}
