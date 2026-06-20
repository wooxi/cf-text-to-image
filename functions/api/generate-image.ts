import { requireAuth } from "../auth";
import { getApiKey, getConfig } from "../db";
import type { Env } from "../db";

function normalizeEndpoint(endpoint: string): string {
  let url = endpoint.replace(/\/+$/, "");
  if (!/\/\/[^\/]+\/.+/.test(url)) url += "/v1";
  return url;
}

function parseError(err: unknown): string {
  try {
    const msg = String((err as any)?.error?.message || (err as any)?.message || "");
    if (msg.includes("content_policy") || msg.includes("safety")) return "内容安全拦截，请修改关键词";
    return msg.substring(0, 200) || "生图失败";
  } catch { return "生图失败"; }
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  try {
    await requireAuth(context.env, context.request);
    const { prompt, keywords, size: reqSize } = await context.request.json() as Record<string, any>;

    const rawEndpoint = await getConfig(context.env, "image_endpoint", await getConfig(context.env, "llm_endpoint", "https://api.openai.com/v1"));
    const endpoint = normalizeEndpoint(rawEndpoint);
    const apiKey = await getApiKey(context.env, "image_api_key") || await getApiKey(context.env, "llm_api_key");
    const model = await getConfig(context.env, "image_model", "dall-e-3");
    const imageProvider = await getConfig(context.env, "image_provider", "openai_image");
    const size = reqSize || "1024x1024";

    if (!apiKey) return Response.json({ success: false, error: "请先设置 IMAGE_API_KEY" }, { status: 400 });

    const actualPrompt = (prompt || keywords || "").trim();
    if (!actualPrompt) return Response.json({ success: false, error: "缺少提示词" }, { status: 400 });

    const suffix = ", natural body proportions, clearly defined limbs uncrossed, professional photography, highly detailed, masterpiece, sharp focus";
    const url = endpoint + "/images/generations";
    const reqBody: Record<string, any> = imageProvider === "agnes_image"
      ? { model, prompt: actualPrompt + suffix, size, extra_body: { response_format: "url" } }
      : { model, prompt: actualPrompt + suffix, size };

    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(reqBody),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      let errData; try { errData = JSON.parse(txt); } catch { errData = { error: { message: txt } }; }
      return Response.json({ success: false, error: parseError(errData) }, { status: 502 });
    }

    const data = await resp.json() as any;
    if (data.error) return Response.json({ success: false, error: parseError(data) }, { status: 502 });

    const img = data.data?.[0];
    if (!img) return Response.json({ success: false, error: "生图返回为空" }, { status: 500 });

    let bytes: ArrayBuffer;
    if (img.b64_json) bytes = Uint8Array.from(atob(img.b64_json), (char) => char.charCodeAt(0)).buffer;
    else if (img.url) bytes = await (await fetch(img.url)).arrayBuffer();
    else return Response.json({ success: false, error: "不支持的格式" }, { status: 500 });

    const filename = `${crypto.randomUUID()}.png`;
    if (context.env.IMAGES_BUCKET) {
      await context.env.IMAGES_BUCKET.put(`images/${filename}`, bytes, { httpMetadata: { contentType: "image/png" } });
    }
    const imagePath = context.env.IMAGES_BUCKET ? `/api/images?file=${filename}` : `data:image/png;base64,${btoa(String.fromCharCode(...new Uint8Array(bytes)))}`;

    await context.env.DB.prepare(
      "INSERT INTO image_history (keyword_names, prompt, image_path, type, created_at) VALUES (?, ?, ?, 'image', ?)"
    ).bind(keywords || prompt, actualPrompt, imagePath, new Date().toISOString()).run();

    return Response.json({ success: true, data: { imagePath, prompt: actualPrompt } });
  } catch (error) {
    if ((error as Error).message === "Unauthorized") return Response.json({ success: false, error: "未登录" }, { status: 401 });
    return Response.json({ success: false, error: "生成失败" }, { status: 500 });
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: { Allow: "POST, OPTIONS" } });
}
