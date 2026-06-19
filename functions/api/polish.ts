import { requireAuth } from "../auth";
import type { Env } from "../db";

const SYSTEM_PROMPT = `你是专业的画面描述优化师。润色中文画面描述：更丰富、更有氛围感、更文学化。
纯中文输出，不加任何前缀或解释，一段话写完。`;

export async function onRequestPost(context: { request: Request; env: Env }) {
  try {
    await requireAuth(context.env, context.request);
    const { text, mode } = await context.json() as { text?: string; mode?: string };
    if (!text || !text.trim()) {
      return Response.json({ success: false, error: "请输入内容" }, { status: 400 });
    }

    const endpoint = context.env.LLM_ENDPOINT || "https://api.openai.com/v1";
    const apiKey = context.env.LLM_API_KEY;
    const model = "gpt-4o";

    if (!apiKey) {
      return Response.json({ success: false, error: "请先在 CF Pages 设置页填入 LLM_API_KEY" }, { status: 400 });
    }

    const url = endpoint.replace(/\/+$/, "") + "/chat/completions";
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `请润色：${text}` },
        ],
        temperature: 0.9,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      return Response.json({ success: false, error: `错误: ${await response.text()}` }, { status: 500 });
    }

    const data = await response.json() as any;
    const polished = data.choices?.[0]?.message?.content?.trim();
    if (!polished) return Response.json({ success: false, error: "润色失败" }, { status: 500 });

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
