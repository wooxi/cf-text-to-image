import { handleError, ok, readJson, HttpError } from "../lib/http";
import { getLlmSettings } from "../lib/env";
import type { Env } from "../lib/env";
import { requireAuth } from "../lib/auth";
import { chatCompletion } from "../lib/llm";

const MAX_KEYWORDS = 80;

/** POST /api/generate-prompt — 关键词 → 画面描述。 */
export async function onRequestPost(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  try {
    await requireAuth(context.env, context.request);
    const settings = await getLlmSettings(context.env);

    const body = await readJson<{ keywords?: { name?: unknown }[] }>(
      context.request,
    );
    if (!Array.isArray(body.keywords))
      throw new HttpError(400, "keywords 必须是数组");
    if (body.keywords.length > MAX_KEYWORDS) {
      throw new HttpError(400, `关键词最多 ${MAX_KEYWORDS} 个`);
    }

    const names = body.keywords
      .map((keyword) =>
        typeof keyword?.name === "string" ? keyword.name.trim() : "",
      )
      .filter(Boolean);
    if (!names.length) throw new HttpError(400, "请至少选择一个关键词");

    const prompt = await chatCompletion({
      endpoint: settings.endpoint,
      apiKey: settings.apiKey,
      model: settings.model,
      system: settings.promptSystemImage,
      user: `请根据以下关键词生成画面描述：${names.join("、")}`,
    });

    return ok({ prompt });
  } catch (e) {
    return handleError("api:generate-prompt", e, "生成失败");
  }
}
