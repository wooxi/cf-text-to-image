import { requireAdmin, HttpError, isHttpError } from "../auth";
import { getConfigs } from "../db";
import type { Env } from "../db";

function normalizeEndpoint(endpoint: string): string {
  let url = endpoint.replace(/\/+$/, "");
  if (!/\/\/[^/]+\/.+/.test(url)) url += "/v1";
  return url;
}

const TIMEOUT_MS = 15_000;

export async function onRequestPost(context: { request: Request; env: Env }) {
  try {
    await requireAdmin(context.env, context.request);
    const body = await context.request.json() as { endpoint?: string };
    const rawEndpoint = (body.endpoint || "").trim();
    if (!rawEndpoint) throw new HttpError(400, "请提供端点地址");

    const config = await getConfigs(context.env);
    const endpoint = normalizeEndpoint(rawEndpoint);
    const headers: Record<string, string> = {};
    if (config.llm_api_key) headers["Authorization"] = `Bearer ${config.llm_api_key}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let resp: Response;
    try {
      resp = await fetch(endpoint + "/models", { headers, signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!resp.ok) {
      const txt = await resp.text().catch(() => "");
      return Response.json({ success: false, error: `获取模型列表失败 (${resp.status}): ${txt.slice(0, 200)}` }, { status: 502 });
    }

    const data = await resp.json() as any;
    const models: string[] = (data.data || data.models || [])
      .map((m: any) => m.id || m.name || "")
      .filter((id: string) => id && !id.includes("dall-e") && !id.includes("whisper") && !id.includes("tts"))
      .sort();

    if (!models.length) return Response.json({ success: false, error: "该端点未返回可用模型" }, { status: 502 });
    return Response.json({ success: true, data: models });
  } catch (e) {
    if (isHttpError(e)) return Response.json({ success: false, error: e.message }, { status: e.status });
    if ((e as Error).name === "AbortError") return Response.json({ success: false, error: "请求超时" }, { status: 504 });
    return Response.json({ success: false, error: `请求失败: ${(e as Error).message}` }, { status: 500 });
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: { Allow: "POST, OPTIONS" } });
}
