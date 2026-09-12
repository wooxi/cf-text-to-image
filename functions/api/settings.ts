import { handleError, ok, fail, readJson, HttpError } from "../lib/http";
import {
  getLlmSettings,
  loadConfig,
  missingConfig,
  storageMode,
} from "../lib/env";
import type { Env } from "../lib/env";
import { requireAuth } from "../lib/auth";
import {
  EDITABLE_KEYS,
  SECRET_KEYS,
  loadSettings,
  saveSettings,
} from "../lib/settings";
import { normalizeEndpoint } from "../lib/endpoints";

const PING_TIMEOUT_MS = 15_000;
const MAX_VALUE_CHARS = 20_000;

/**
 * 设置页唯一的接口：GET 读、PUT 存、POST 测连通性。
 * 密钥只回「填没填」，值永远不回传。
 */
export async function onRequestGet(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  try {
    await requireAuth(context.env, context.request);
    const stored = await loadSettings(context.env);
    const config = await loadConfig(context.env);

    const values: Record<string, string> = {};
    const secrets: Record<string, boolean> = {};
    for (const key of EDITABLE_KEYS) {
      const value = (stored[key] ?? "").trim();
      if (SECRET_KEYS.has(key)) secrets[key] = Boolean(value);
      else values[key] = value;
    }
    // 提示词没存过就显示内置那份，所见即所用
    values.prompt_system_image = config.promptSystemImage;
    values.prompt_system_polish = config.promptSystemPolish;

    return ok({
      values,
      secrets,
      missing: missingConfig(config),
      storage: storageMode(config),
    });
  } catch (e) {
    return handleError("settings:get", e, "读取配置失败");
  }
}

/** 密钥字段传 null 表示「不修改」，传空串表示清除。 */
export async function onRequestPut(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  try {
    await requireAuth(context.env, context.request);
    const body = await readJson<Record<string, unknown>>(context.request);

    const entries: Record<string, string> = {};
    for (const key of EDITABLE_KEYS) {
      if (!(key in body)) continue;
      const raw = body[key];
      if (raw === null) continue;
      if (typeof raw !== "string") throw new HttpError(400, `${key} 格式错误`);
      const value = raw.trim();
      if (value.length > MAX_VALUE_CHARS)
        throw new HttpError(400, `${key} 超过 ${MAX_VALUE_CHARS} 字`);
      entries[key] = value;
    }
    if (!Object.keys(entries).length) throw new HttpError(400, "没有要保存的内容");

    await saveSettings(context.env, entries);
    return ok({ saved: Object.keys(entries).length });
  } catch (e) {
    return handleError("settings:put", e, "保存失败");
  }
}

/** POST /api/settings — 用当前 LLM 配置拉一次模型列表，验证连通性。 */
export async function onRequestPost(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  try {
    await requireAuth(context.env, context.request);
    const settings = getLlmSettings(await loadConfig(context.env));

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
    if (e instanceof Error && e.name === "AbortError") return fail("请求超时", 504);
    return handleError("settings:ping", e, "连通性检测失败");
  }
}
