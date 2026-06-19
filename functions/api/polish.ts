import { requireAuth } from "../auth";
import { getApiKey } from "./config";
import type { Env } from "../db";

function normalizeEndpoint(endpoint: string): string {
  let url = endpoint.replace(/\/+$/, "");
  if (!/\/\/[^\/]+\/.+/.test(url)) url += "/v1";
  return url;
}

const SYSTEM_PROMPT = "你是专业的画面描述优化师。润色中文画面描述：更丰富、更有氛围感、更文学化。纯中文输出，不加任何前缀或解释，一段话写完。";

export async function onRequestPost(context: { request: Request; env: Env }) {
  try {
    await requireAuth(context.env, context.request);
    const { text } = await context.json() as { text?: string };
    if (!text?.trim()) {
      return Response.json({ success: false, error: "请输入内容" }, { status: 400 });
    }

    const rawEndpoint = context.env.LLM_ENDPOINT || "https://api.openai.com/v1";
    const endpoint = normalizeEndpoint(rawEndpoint);
    const apiKey = await getApiKey(context.env, "llm_api_key");
    const model = context.env.LLM_MODEL || "gpt-4o";

    if (!apiKey) {
      return Response.json({ success: false, error: "请先在后台管理页设置 LLM_API_KEY" }, { status: 400 });
    }

    const url = endpoint + "/chat/completions";
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: `请润色：${text}` }], temperature: 0.9, max_tokens: 4096 }),
    });

    if (!response.ok) {
      return Response.json({ success: false, error: `润色失败 (${response.status})` }, { status: 502 });
    }

    const data = await response.json() as any;
    const polished = data.choices?.[0]?.message?.content?.trim();
    if (!polished) return Response.json({ success: false, error: "润色结果为空" }, { status: 500 });

    return Response.json({ success: true, data: { text: polished } });
  } catch (e) {
    if ((e as Error).message === "Unauthorized") {
      return Response.json({ success: false, error: "未登录" }, { status: 401 });
    }
    return Response.json({ success: false, error: "润色失败" }, { status: 500 });
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: { Allow: "POST, OPTIONS" } });
}
