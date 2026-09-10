import { handleError, ok, fail } from "../lib/http";
import {
  DEFAULT_IMAGE_PROMPT,
  DEFAULT_POLISH_PROMPT,
  ENV_VARS,
  getLlmSettings,
  missingEnvVars,
} from "../lib/env";
import type { Env } from "../lib/env";
import { requireAuth } from "../lib/auth";
import { normalizeEndpoint } from "../lib/endpoints";

const PING_TIMEOUT_MS = 15_000;

/** GET /api/config — 环境变量自检 + 当前生效的非机密配置。密钥永不回传。 */
export async function onRequestGet(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  try {
    await requireAuth(context.env, context.request);
    const env = context.env;

    return ok({
      required: ENV_VARS,
      missing: missingEnvVars(env),
      resolved: {
        llmEndpoint: env.LLM_ENDPOINT?.trim() ?? "",
        llmModel: env.LLM_MODEL?.trim() ?? "",
        imageEndpoint: env.IMAGE_ENDPOINT?.trim() ?? "",
        imageModel: env.IMAGE_MODEL?.trim() ?? "",
        promptSystemImage:
          env.PROMPT_SYSTEM_IMAGE?.trim() || DEFAULT_IMAGE_PROMPT,
        promptSystemPolish:
          env.PROMPT_SYSTEM_POLISH?.trim() || DEFAULT_POLISH_PROMPT,
      },
      overrides: {
        image: Boolean(env.PROMPT_SYSTEM_IMAGE?.trim()),
        polish: Boolean(env.PROMPT_SYSTEM_POLISH?.trim()),
      },
    });
  } catch (e) {
    return handleError("config:get", e, "读取状态失败");
  }
}

/** POST /api/config — 用已配置的 LLM 端点与密钥拉一次模型列表，验证连通性。 */
export async function onRequestPost(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  try {
    await requireAuth(context.env, context.request);
    const settings = getLlmSettings(context.env);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(normalizeEndpoint(settings.endpoint) + "/models", {
        headers: { Authorization: `Bearer ${settings.apiKey}` },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) return ok({ reachable: false, status: response.status });

    const data = (await response.json()) as {
      data?: unknown[];
      models?: unknown[];
    };
    const models = [...(data.data ?? []), ...(data.models ?? [])]
      .map((entry) => {
        const item = entry as { id?: string; name?: string };
        return item.id ?? item.name ?? "";
      })
      .filter(Boolean)
      .sort();

    return ok({ reachable: true, models });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError")
      return fail("请求超时", 504);
    return handleError("config:ping", e, "连通性检测失败");
  }
}
