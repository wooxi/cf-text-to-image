import { requireAuth } from "../auth";
import type { Env } from "../db";

const IMAGE_SYSTEM_PROMPT = `你是一位顶尖的时尚摄影师和视觉总监。根据用户提供的关键词标签，写一段丰富的画面描述。

规则：
1. 纯中文输出，高质量文学描写
2. 用一段话叙述，不列点
3. 从全景到特写：先场景环境，再到主体人物、服装细节、表情神态、光影氛围
4. 安全红线：
   - 不描写身体裸露，改为"衣着得体的""穿着完整的"
   - 不描写紧身或透明服装，改为"宽松的""垂坠感的"
   - 需要表现曲线时用"服装的褶皱和垂坠自然勾勒出优雅的轮廓"
5. 禁止：裸露、透明、透视装、暗示性姿势、浴缸/床上等场景`;

const VIDEO_SYSTEM_PROMPT = `你是一位顶尖视频导演。根据用户描述，润色为更丰富的视频画面描述，补充镜头运动、动作节奏。纯中文输出，一段话写完。`;

export async function onRequestPost(context: { request: Request; env: Env }) {
  try {
    await requireAuth(context.env, context.request);
    const { keywords, mode } = await context.json() as { keywords: any[]; mode?: string };

    const endpoint = context.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
    const apiKey = context.env.OPENAI_API_KEY;
    const model = "gpt-4o";

    if (!apiKey) {
      return Response.json({ success: false, error: "请先设置 OPENAI_API_KEY（通过 wrangler secret put）" }, { status: 400 });
    }

    const keywordNames = Array.isArray(keywords) 
      ? keywords.map((k: any) => k.name || k).join(", ")
      : "";

    const isVideo = mode === "video";
    const systemPrompt = isVideo ? VIDEO_SYSTEM_PROMPT : IMAGE_SYSTEM_PROMPT;

    const url = endpoint.replace(/\/+$/, "") + "/chat/completions";
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `请根据以下关键词生成画面描述（如果带数字如2048、1024等说明是尺寸，请在描述后注明）：${keywordNames}` },
        ],
        temperature: 0.9,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      return Response.json({ success: false, error: `LLM 错误: ${await response.text()}` }, { status: 500 });
    }

    const data = await response.json() as any;
    const prompt = data.choices?.[0]?.message?.content?.trim();

    if (!prompt) {
      return Response.json({ success: false, error: "生成失败" }, { status: 500 });
    }

    return Response.json({ success: true, data: { prompt } });
  } catch (e) {
    if ((e as Error).message === "Unauthorized") {
      return Response.json({ success: false, error: "未登录" }, { status: 401 });
    }
    return Response.json({ success: false, error: "生成提示词失败" }, { status: 500 });
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: { Allow: "POST, OPTIONS" } });
}
