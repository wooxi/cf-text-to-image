import { handleError, ok, readJson, HttpError } from "../lib/http";
import { getLlmSettings } from "../lib/env";
import type { Env } from "../lib/env";
import { requireAuth } from "../lib/auth";
import { chatCompletion } from "../lib/llm";

const MAX_TEXT_CHARS = 6000;

/** POST /api/polish — 润色画面描述。 */
export async function onRequestPost(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  try {
    await requireAuth(context.env, context.request);
    const settings = getLlmSettings(context.env);

    const body = await readJson<{ text?: unknown }>(context.request);
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) throw new HttpError(400, "请输入内容");
    if (text.length > MAX_TEXT_CHARS) {
      throw new HttpError(400, `内容最长 ${MAX_TEXT_CHARS} 字`);
    }

    const polished = await chatCompletion({
      endpoint: settings.endpoint,
      apiKey: settings.apiKey,
      model: settings.model,
      system: settings.promptSystemPolish,
      user: `请润色：${text}`,
    });

    return ok({ text: polished });
  } catch (e) {
    return handleError("api:polish", e, "润色失败");
  }
}
