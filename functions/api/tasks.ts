import { requireAuth } from "../auth";
import { getApiKey, getConfig } from "../db";
import type { Env } from "../db";

function normalizeEndpoint(endpoint: string): string {
  let url = endpoint.replace(/\/+$/, "");
  if (!/\/\/[^\/]+\/.+/.test(url)) url += "/v1";
  return url;
}

export async function onRequestGet(context: { request: Request; env: Env }) {
  try {
    await requireAuth(context.env, context.request);
    const url = new URL(context.request.url);
    const statusFilter = url.searchParams.get("status") || "";
    let query = "SELECT * FROM tasks";
    const params: any[] = [];
    if (statusFilter) {
      const statuses = statusFilter.split(",");
      query += " WHERE status IN (" + statuses.map(() => "?").join(",") + ")";
      params.push(...statuses);
    }
    query += " ORDER BY created_at DESC LIMIT 50";
    const result = await context.env.DB.prepare(query).bind(...params).all();
    return Response.json({ success: true, data: result.results });
  } catch (e) {
    if ((e as Error).message === "Unauthorized") return Response.json({ success: false, error: "未登录" }, { status: 401 });
    return Response.json({ success: false, error: "获取任务失败" }, { status: 500 });
  }
}

export async function onRequestPost(context: { request: Request; env: Env; ctx: ExecutionContext }) {
  try {
    await requireAuth(context.env, context.request);
    const body = await context.request.json() as Record<string, any>;
    const now = new Date().toISOString();
    const type = body.type || "image";
    const isVideo = type === "video";

    // Create task with pending status
    await context.env.DB.prepare(
      "INSERT INTO tasks (status, type, keyword_names, prompt, size, reference_image, progress, created_at, updated_at) VALUES ('pending', ?, ?, ?, ?, ?, 0, ?, ?)"
    ).bind(
      type, body.keywords || "", body.prompt || "", body.size || "1024x1024",
      Array.isArray(body.image) ? body.image.join(",") : (body.image || ""),
      now, now
    ).run();

    const lastRow = await context.env.DB.prepare("SELECT last_insert_rowid() as id").first();
    const taskId = (lastRow as any)?.id as number;

    // Process in background via ctx.waitUntil
    context.ctx.waitUntil(
      (async () => {
        try {
          // Mark as processing
          await context.env.DB.prepare(
            "UPDATE tasks SET status = 'processing', updated_at = ? WHERE id = ?"
          ).bind(new Date().toISOString(), taskId).run();

          if (isVideo) {
            await processVideo(context.env, taskId, body);
          } else {
            await processImage(context.env, taskId, body);
          }
        } catch (procErr) {
          await context.env.DB.prepare(
            "UPDATE tasks SET status = 'failed', error = ?, updated_at = ? WHERE id = ?"
          ).bind((procErr as Error).message || "处理失败", new Date().toISOString(), taskId).run();
        }
      })()
    );

    // Return immediately
    return Response.json({ success: true, data: { taskId } });
  } catch (e) {
    if ((e as Error).message === "Unauthorized") return Response.json({ success: false, error: "未登录" }, { status: 401 });
    return Response.json({ success: false, error: "创建失败: " + ((e as Error).message || String(e)) }, { status: 500 });
  }
}

async function processImage(env: Env, taskId: number, body: Record<string, any>) {
  const rawEndpoint = await getConfig(env, "image_endpoint",
    await getConfig(env, "llm_endpoint", "https://api.openai.com/v1"));
  const endpoint = normalizeEndpoint(rawEndpoint);
  const apiKey = await getApiKey(env, "image_api_key") || await getApiKey(env, "llm_api_key");
  const model = await getConfig(env, "image_model", "dall-e-3");
  const size = body.size || "1024x1024";

  if (!apiKey) throw new Error("请先设置 IMAGE_API_KEY");

  const actualPrompt = body.prompt || body.keywords || "";
  if (!actualPrompt.trim()) throw new Error("缺少提示词");

  const url = endpoint + "/images/generations";
  
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, prompt: actualPrompt, n: 1, size }),
  });

  if (!resp.ok) {
    const txt = await resp.text();
    let err = txt;
    try { err = JSON.parse(txt).error?.message || txt; } catch {}
    throw new Error("生图失败: " + err.substring(0, 200));
  }

  const data = await resp.json() as any;
  if (data.error) throw new Error("生图失败: " + (data.error.message || "未知错误"));
  
  const img = data.data?.[0];
  if (!img) throw new Error("生图返回为空");

  let bytes: ArrayBuffer;
  if (img.b64_json) bytes = Uint8Array.from(atob(img.b64_json), c => c.charCodeAt(0)).buffer;
  else if (img.url) bytes = await (await fetch(img.url)).arrayBuffer();
  else throw new Error("不支持的格式");

  const filename = `${crypto.randomUUID()}.png`;
  const r2Key = `images/${filename}`;
  if (env.IMAGES_BUCKET) {
    await env.IMAGES_BUCKET.put(r2Key, bytes, { httpMetadata: { contentType: "image/png" } });
  }

  const imagePath = env.IMAGES_BUCKET ? `/api/images?file=${filename}` :
    `data:image/png;base64,${btoa(String.fromCharCode(...new Uint8Array(bytes)))}`;

  // Save to history
  await env.DB.prepare(
    "INSERT INTO image_history (keyword_names, prompt, image_path, type, created_at) VALUES (?, ?, ?, 'image', ?)"
  ).bind(body.keywords || "", actualPrompt, imagePath, new Date().toISOString()).run();

  // Update task
  await env.DB.prepare(
    "UPDATE tasks SET status = 'completed', image_path = ?, progress = 100, updated_at = ? WHERE id = ?"
  ).bind(imagePath, new Date().toISOString(), taskId).run();
}

async function processVideo(env: Env, taskId: number, body: Record<string, any>) {
  const rawEndpoint = await getConfig(env, "video_endpoint", "https://apihub.agnes-ai.com");
  const endpoint = normalizeEndpoint(rawEndpoint);
  const apiKey = await getApiKey(env, "video_api_key");
  const model = await getConfig(env, "video_model", "agnes-video-v2.0");

  if (!apiKey) throw new Error("请先设置 VIDEO_API_KEY");

  const actualPrompt = body.prompt || "";
  if (!actualPrompt.trim()) throw new Error("缺少提示词");

  const resp = await fetch(endpoint + "/videos/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model, prompt: actualPrompt,
      width: body.width || 1920, height: body.height || 1080,
      num_frames: body.num_frames || 121, frame_rate: body.frame_rate || 24,
    }),
  });

  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error("视频生成失败: " + txt.substring(0, 200));
  }

  const data = await resp.json() as any;
  const videoUrl = data.url || data.video_url || "";
  const posterUrl = data.poster || data.thumbnail || "";

  await env.DB.prepare(
    "INSERT INTO image_history (keyword_names, prompt, image_path, type, poster_path, created_at) VALUES (?, ?, ?, 'video', ?, ?)"
  ).bind(body.keywords || "", actualPrompt, videoUrl, posterUrl, new Date().toISOString()).run();

  await env.DB.prepare(
    "UPDATE tasks SET status = 'completed', image_path = ?, poster_path = ?, progress = 100, updated_at = ? WHERE id = ?"
  ).bind(videoUrl, posterUrl, new Date().toISOString(), taskId).run();
}

export async function onRequestDelete(context: { request: Request; env: Env }) {
  try {
    await requireAuth(context.env, context.request);
    const url = new URL(context.request.url);
    const id = url.searchParams.get("id");
    if (!id) return Response.json({ success: false, error: "缺少ID" }, { status: 400 });
    await context.env.DB.prepare("DELETE FROM tasks WHERE id = ?").bind(parseInt(id)).run();
    return Response.json({ success: true });
  } catch (e) {
    if ((e as Error).message === "Unauthorized") return Response.json({ success: false, error: "未登录" }, { status: 401 });
    return Response.json({ success: false, error: "删除失败" }, { status: 500 });
  }
}

export async function onRequestPut(context: { request: Request; env: Env; ctx: ExecutionContext }) {
  try {
    await requireAuth(context.env, context.request);
    const body = await context.request.json() as { id?: number; type?: string; keywords?: string; prompt?: string; size?: string; image?: string[] };
    if (!body.id) return Response.json({ success: false, error: "缺少ID" }, { status: 400 });
    
    const now = new Date().toISOString();
    await context.env.DB.prepare(
      "UPDATE tasks SET status = 'pending', progress = 0, error = '', updated_at = ? WHERE id = ?"
    ).bind(now, body.id).run();

    // Reprocess in background
    const taskId = body.id;
    const isVideo = body.type === "video";
    context.ctx.waitUntil(
      (async () => {
        try {
          await context.env.DB.prepare(
            "UPDATE tasks SET status = 'processing', updated_at = ? WHERE id = ?"
          ).bind(new Date().toISOString(), taskId).run();

          if (isVideo) {
            await processVideo(context.env, taskId, body);
          } else {
            await processImage(context.env, taskId, body);
          }
        } catch (procErr) {
          await context.env.DB.prepare(
            "UPDATE tasks SET status = 'failed', error = ?, updated_at = ? WHERE id = ?"
          ).bind((procErr as Error).message || "处理失败", new Date().toISOString(), taskId).run();
        }
      })()
    );

    return Response.json({ success: true });
  } catch (e) {
    if ((e as Error).message === "Unauthorized") return Response.json({ success: false, error: "未登录" }, { status: 401 });
    return Response.json({ success: false, error: "重试失败: " + ((e as Error).message || String(e)) }, { status: 500 });
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: { Allow: "GET, POST, PUT, DELETE, OPTIONS" } });
}
