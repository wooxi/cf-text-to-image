import { requireAuth } from "../auth";
import { getApiKey, getConfig } from "../db";
import type { Env } from "../db";

function normalizeEndpoint(endpoint: string): string {
  let url = endpoint.replace(/\/+$/, "");
  if (!/\/\/[^\/]+\/.+/.test(url)) url += "/v1";
  return url;
}

const DEFAULT_IMAGE_PROMPT = `你是一位顶尖的创意导演和商业摄影师，擅长从关键词卡片生成有氛围感、有随机惊喜的画面描述。你的任务是根据用户选择的分类关键词，生成一段可直接用于生图的中文提示词。

核心规则：
1. 纯中文输出：只输出一段通顺完整的中文画面描述。不加英文，不加"画面描述："等标题，不加任何解释、前缀。直接从描述内容开始写。
2. 包含画面主体、环境/背景、光线、风格、构图、氛围等要素。
3. 长度控制在 80-300 字之间，自然流畅，不要机械分段。
4. 安全准则：用衣物配饰自然覆盖身体，用光影和构图引导视线，避免写裸体/透视/暗示性内容。`;

const DEFAULT_VIDEO_PROMPT = `你是一位顶尖的视频导演，擅长将关键词转化为生动的视频画面描述。

核心规则：
1. 纯中文输出：只输出一段通顺完整的中文画面描述。
2. 补充镜头运动（推拉摇移）、动作节奏、光影变化等动态要素。
3. 长度控制在 80-300 字之间，一段话写完，不要分段。
4. 描述要有时间流动感，体现视频的动态特征。`;

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
    const defaultPrompt = isVideo ? DEFAULT_VIDEO_PROMPT : DEFAULT_IMAGE_PROMPT;
    const systemPrompt = await getConfig(context.env, isVideo ? "prompt_system_video" : "prompt_system_image", defaultPrompt);

    const LLM_TIMEOUT_MS = 25000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

    try {
      const url = endpoint + "/chat/completions";
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: `请根据以下关键词生成画面描述：${keywordNames}` }], temperature: 0.9, max_tokens: 4096, thinking: { type: "disabled" } }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errText = await response.text();
        return Response.json({ success: false, error: `LLM 调用失败 (${response.status}): ${errText.substring(0, 300)}` }, { status: 502 });
      }

      const data = await response.json() as any;
      const prompt = data.choices?.[0]?.message?.content?.trim();
      if (!prompt) return Response.json({ success: false, error: "生成结果为空" }, { status: 500 });

      return Response.json({ success: true, data: { prompt } });
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (e) {
    if ((e as Error).message === "Unauthorized") return Response.json({ success: false, error: "未登录" }, { status: 401 });
    if ((e as Error).name === "AbortError") return Response.json({ success: false, error: "LLM 调用超时，请稍后重试" }, { status: 504 });
    return Response.json({ success: false, error: "Error: " + ((e as Error).message || String(e)) }, { status: 500 });
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: { Allow: "POST, OPTIONS" } });
}
