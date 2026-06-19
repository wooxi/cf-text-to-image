import { requireAuth } from "../auth";
import type { Env } from "../db";

function normalizeEndpoint(endpoint: string): string {
  let url = endpoint.replace(/\/+$/, "");
  if (!/\/\/[^\/]+\/.+/.test(url)) {
    url += "/v1";
  }
  return url;
}

function parseContentPolicyError(errorData: unknown): string {
  try {
    const err = errorData as Record<string, unknown>;
    const msg = String(err?.message || err?.error || "");
    if (msg.includes("内容政策") || msg.includes("content_policy") || msg.includes("性化")) {
      return "内容安全拦截：提示词中可能包含不当描述，请修改关键词后重试。";
    }
    if (msg.includes("安全") || msg.includes("违规") || msg.includes("policy")) {
      return "内容安全拦截：提示词未通过安全审核，请调整关键词。";
    }
    return "生图失败：" + msg.substring(0, 200);
  } catch { return "生图失败：未知错误"; }
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  try {
    await requireAuth(context.env, context.request);
    const { prompt, keywords, type, size: reqSize, image, video_mode, width, height, num_frames, frame_rate } = 
      await context.json() as Record<string, any>;

    const rawEndpoint = (context.env as any).IMAGE_ENDPOINT || context.env.LLM_ENDPOINT || "https://api.openai.com/v1";
    const endpoint = normalizeEndpoint(rawEndpoint);
    const apiKey = (context.env as any).IMAGE_API_KEY || context.env.LLM_API_KEY;
    const model = (context.env as any).IMAGE_MODEL || "dall-e-3";
    const size = reqSize || "1024x1024";

    if (!apiKey) {
      return Response.json({ success: false, error: "请先设置 IMAGE_API_KEY（通过 CF Pages 环境变量）" }, { status: 400 });
    }

    const actualPrompt = (prompt || keywords || "").trim();
    if (!actualPrompt && type !== "img2img") {
      return Response.json({ success: false, error: "缺少提示词" }, { status: 400 });
    }

    // Image generation
    const url = endpoint + "/images/generations";
    const qualitySuffix = ", professional photography, highly detailed, masterpiece, sharp focus, elegant composition, natural lighting, clean aesthetic";
    
    const imgResponse = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        prompt: actualPrompt + qualitySuffix,
        n: 1,
        size,
      }),
    });

    if (!imgResponse.ok) {
      const errText = await imgResponse.text();
      let errData: unknown;
      try { errData = JSON.parse(errText); } catch { errData = { error: { message: errText } }; }
      return Response.json({ success: false, error: parseContentPolicyError(errData) }, { status: 500 });
    }

    const data = await imgResponse.json() as any;
    if (data.error) {
      return Response.json({ success: false, error: parseContentPolicyError(data) }, { status: 500 });
    }

    const imageData = data.data?.[0];
    if (!imageData) {
      return Response.json({ success: false, error: "生图返回为空" }, { status: 500 });
    }

    // Download and store in R2
    let imageBytes: ArrayBuffer;
    if (imageData.b64_json) {
      imageBytes = Uint8Array.from(atob(imageData.b64_json), c => c.charCodeAt(0)).buffer;
    } else if (imageData.url) {
      const dlResp = await fetch(imageData.url);
      imageBytes = await dlResp.arrayBuffer();
    } else {
      return Response.json({ success: false, error: "生图返回格式不支持" }, { status: 500 });
    }

    // Store in R2
    const filename = `${crypto.randomUUID()}.png`;
    const r2Key = `images/${filename}`;
    
    if ((context.env as any).IMAGES_BUCKET) {
      await (context.env as any).IMAGES_BUCKET.put(r2Key, imageBytes, {
        httpMetadata: { contentType: "image/png" },
      });
    }

    const imagePath = (context.env as any).IMAGES_BUCKET 
      ? `/images/${filename}`
      : `data:image/png;base64,${btoa(String.fromCharCode(...new Uint8Array(imageBytes)))}`;

    // Save to history
    const now = new Date().toISOString();
    await context.env.DB.prepare(
      "INSERT INTO image_history (keyword_names, prompt, image_path, type, created_at) VALUES (?, ?, ?, 'image', ?)"
    ).bind(keywords || prompt, actualPrompt, imagePath, now).run();

    return Response.json({ success: true, data: { imagePath, prompt: actualPrompt } });
  } catch (e) {
    if ((e as Error).message === "Unauthorized") {
      return Response.json({ success: false, error: "未登录" }, { status: 401 });
    }
    return Response.json({ success: false, error: `生成失败: ${(e as Error).message}` }, { status: 500 });
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: { Allow: "POST, OPTIONS" } });
}
