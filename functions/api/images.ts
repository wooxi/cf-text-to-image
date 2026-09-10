import { handleError, HttpError } from "../lib/http";
import type { Env } from "../lib/env";
import { requireAuth } from "../lib/auth";
import { IMAGE_PREFIX, contentTypeForExt, isSafeKey } from "../lib/media";

/** GET /api/images?file=<name> — 生成结果，必须登录。 */ export async function onRequestGet(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  try {
    await requireAuth(context.env, context.request);

    const file = new URL(context.request.url).searchParams.get("file") ?? "";
    if (!isSafeKey(file)) throw new HttpError(400, "文件名不合法");

    const object = await context.env.IMAGES_BUCKET.get(IMAGE_PREFIX + file);
    if (!object) throw new HttpError(404, "文件不存在");

    const ext = file.split(".").pop() ?? "";
    return new Response(object.body, {
      headers: {
        "Content-Type":
          object.httpMetadata?.contentType || contentTypeForExt(ext),
        // 文件名是 UUID 且内容不可变；private 让浏览器缓存，但不让共享缓存复用给他人
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  } catch (e) {
    return handleError("images:get", e, "读取图片失败");
  }
}
