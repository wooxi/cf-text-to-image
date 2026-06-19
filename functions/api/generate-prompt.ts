import { requireAuth } from "../auth";
import { getApiKey, getConfig } from "../db";
import type { Env } from "../db";

function normalizeEndpoint(endpoint: string): string {
  let url = endpoint.replace(/\/+$/, "");
  if (!/\/\/[^\/]+\/.+/.test(url)) url += "/v1";
  return url;
}

const IMAGE_SYSTEM_PROMPT = "你是顶尖时尚摄影师。根据关键词写一段丰富的中文画面描述：从全景到特写，含场景、人物、服装、神态、光影。禁止裸露/透视/暗示性内容。";
const VIDEO_SYSTEM_PROMPT = "你是顶尖视频导演。润色为更丰富的视频画面描述，补充镜头运动、动作节奏。纯中文，一段话写完。";

export async function onRequestPost(context: { request: Request; env: Env }) {
  try {
    await requireAuth(context.env, context.request);
    const { keywords, mode } = await context.request.json() as { keywords: any[]; mode?: string };

    const rawEndpoint = await getConfig(context.env, "llm_endpoint", "https://api.openai.com/v1");
    const endpoint = normalizeEndpoint(rawEndpoint);
    const apiKey = await getApiKey(context.env, "llm_api_key");
    const model = await getConfig(context.env, "llm_model", "gpt-4o");

    if (!apiKey) {
      return Response.json({ success: false, error: "请先在后台管理页设置 LLM_API_KEY" }, { status: 400 });
    }

    const keywordNames = Array.isArray(keywords) ? keywords.map((k: any) => k.name || k).join(", ") : "";
    const isVideo = mode === "video";
    const systemPrompt = isVideo ? VIDEO_SYSTEM_PROMPT : IMAGE_SYSTEM_PROMPT;

    const url = endpoint + "/chat/completions";
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: `请根据以下关键词生成画面描述：${keywordNames}` }], temperature: 0.9, max_tokens: 4096 }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return Response.json({ success: false, error: `LLM 调用失败 (${response.status}): ${errText.substring(0, 300)}` }, { status: 502 });
    }

    const data = await response.json() as any;
    const prompt = data.choices?.[0]?.message?.content?.trim();
    if (!prompt) return Response.json({ success: false, error: "生成结果为空" }, { status: 500 });

    return Response.json({ success: true, data: { prompt } });
  } catch (e) {
    if ((e as Error).message === "Unauthorized") return Response.json({ success: false, error: "未登录" }, { status: 401 });
    return Response.json({ success: false, error: "Error: " + ((e as Error).message || String(e)) }, { status: 500 });
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: { Allow: "POST, OPTIONS" } });
}
