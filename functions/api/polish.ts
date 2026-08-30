import { requireAuth, HttpError, isHttpError } from "../auth";
import { getConfigs } from "../db";
import type { Env } from "../db";

function normalizeEndpoint(endpoint: string): string {
  let url = endpoint.replace(/\/+$/, "");
  if (!/\/\/[^/]+\/.+/.test(url)) url += "/v1";
  return url;
}

const DEFAULT_POLISH_PROMPT = `你是一位专业的画面描述优化师。润色中文画面描述：更丰富、更有氛围感、更文学化。纯中文输出，一段话写完，不要机械分段。保持原意，增强画面感和细节描写。`;

const LLM_TIMEOUT_MS = 90_000;

export async function onRequestPost(context: { request: Request; env: Env }) {
  try {
    await requireAuth(context.env, context.request);
    const { text } = await context.request.json() as { text?: string };
    if (!text?.trim()) throw new HttpError(400, "请输入内容");

    const config = await getConfigs(context.env);
    const endpoint = normalizeEndpoint(config.llm_endpoint || "https://api.openai.com/v1");
    const apiKey = config.llm_api_key;
    const model = config.llm_model || "gpt-4o";
    if (!apiKey) throw new HttpError(400, "请先在后台管理页设置 LLM API Key");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);
    try {
      const response = await fetch(endpoint + "/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: config.prompt_system_polish || DEFAULT_POLISH_PROMPT },
            { role: "user", content: `请润色：${text}` },
          ],
          temperature: 0.9,
          max_tokens: 4096,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        return Response.json({ success: false, error: `润色失败 (${response.status})` }, { status: 502 });
      }

      const data = await response.json() as any;
      const polished = data.choices?.[0]?.message?.content?.trim();
      if (!polished) return Response.json({ success: false, error: "润色结果为空" }, { status: 502 });
      return Response.json({ success: true, data: { text: polished } });
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (e) {
    if (isHttpError(e)) return Response.json({ success: false, error: e.message }, { status: e.status });
    if ((e as Error).name === "AbortError") return Response.json({ success: false, error: "润色超时，请稍后重试" }, { status: 504 });
    return Response.json({ success: false, error: "润色失败" }, { status: 500 });
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: { Allow: "POST, OPTIONS" } });
}
