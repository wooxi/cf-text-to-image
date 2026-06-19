import { requireAuth } from "../auth";
import { getApiKey } from "../db";
import type { Env } from "../db";

function normalizeEndpoint(endpoint: string): string {
  let url = endpoint.replace(/\/+$/, "");
  if (!/\/\/[^\/]+\/.+/.test(url)) url += "/v1";
  return url;
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  try {
    await requireAuth(context.env, context.request);
    const body = await context.request.json() as { endpoint?: string };
    const rawEndpoint = (body.endpoint || "").trim();
    if (!rawEndpoint) return Response.json({ success: false, error: "请提供端点地址" }, { status: 400 });

    const endpoint = normalizeEndpoint(rawEndpoint);
    const apiKey = await getApiKey(context.env, "llm_api_key");
    const headers: Record<string, string> = {};
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

    const resp = await fetch(endpoint + "/models", { headers });
    if (!resp.ok) {
      const txt = await resp.text().catch(() => "");
      return Response.json({ success: false, error: `获取模型列表失败 (${resp.status}): ${txt.substring(0, 200)}` }, { status: 502 });
    }

    const data = await resp.json() as any;
    const models: string[] = (data.data || data.models || [])
      .map((m: any) => m.id || m.name || "")
      .filter((id: string) => id && !id.includes("dall-e") && !id.includes("whisper") && !id.includes("tts"))
      .sort();

    if (!models.length) return Response.json({ success: false, error: "该端点未返回可用模型" }, { status: 404 });

    return Response.json({ success: true, data: models });
  } catch (e) {
    if ((e as Error).message === "Unauthorized") {
      return Response.json({ success: false, error: "未登录" }, { status: 401 });
    }
    return Response.json({ success: false, error: `请求失败: ${(e as Error).message}` }, { status: 500 });
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: { Allow: "POST, OPTIONS" } });
}
