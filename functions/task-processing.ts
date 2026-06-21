import { getApiKey, getConfig } from "./db";
import type { Env } from "./db";

interface TaskRow {
  id: number;
  status: string;
  type: string;
  keyword_names: string;
  prompt: string;
  size: string;
  reference_image: string;
  request_json?: string;
}

export function normalizeEndpoint(endpoint: string): string {
  let url = endpoint.replace(/\/+$/, "");
  if (!/\/\/[^\/]+\/.+/.test(url)) url += "/v1";
  return url;
}

function logTask(event: string, payload: Record<string, unknown>) {
  console.log(JSON.stringify({ scope: "task", event, ...payload }));
}

function parseTaskBody(task: TaskRow): Record<string, any> {
  const raw = task.request_json || "";
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {}
  }

  return {
    type: task.type || "image",
    keywords: task.keyword_names || "",
    prompt: task.prompt || "",
    size: task.size || "1024x1024",
    image: task.reference_image ? task.reference_image.split(",").filter(Boolean) : [],
  };
}

async function markTaskFailed(env: Env, taskId: number, error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "处理失败");
  logTask("failed", { taskId, error: message.slice(0, 500) });
  await env.DB.prepare(
    "UPDATE tasks SET status = 'failed', error = ?, progress = 0, updated_at = ? WHERE id = ?"
  ).bind(message.slice(0, 500), new Date().toISOString(), taskId).run();
}

export async function processTaskById(env: Env, taskId: number): Promise<void> {
  const task = await env.DB.prepare(
    "SELECT id, status, type, keyword_names, prompt, size, reference_image, request_json FROM tasks WHERE id = ?"
  ).bind(taskId).first<TaskRow>();

  if (!task) {
    logTask("missing", { taskId });
    return;
  }
  if (task.status === "completed") {
    logTask("skip-completed", { taskId });
    return;
  }

  const lock = await env.DB.prepare(
    "UPDATE tasks SET status = 'processing', progress = 5, error = '', updated_at = ? WHERE id = ? AND status IN ('pending', 'failed')"
  ).bind(new Date().toISOString(), taskId).run();

  if ((lock.meta?.changes || 0) === 0) {
    const latest = await env.DB.prepare("SELECT status FROM tasks WHERE id = ?").bind(taskId).first<{ status: string }>();
    logTask("lock-skipped", { taskId, status: latest?.status || "missing" });
    if (!latest || latest.status === "completed" || latest.status === "processing") return;
  }

  const body = parseTaskBody(task);
  logTask("start", {
    taskId,
    type: body.type || task.type,
    size: body.size || task.size,
    hasPrompt: Boolean((body.prompt || body.keywords || "").trim()),
    imageCount: Array.isArray(body.image) ? body.image.length : body.image ? 1 : 0,
  });

  try {
    if ((body.type || task.type) === "video") {
      await processVideo(env, taskId, body);
    } else {
      await processImage(env, taskId, body);
    }
  } catch (error) {
    await markTaskFailed(env, taskId, error);
  }
}

async function processImage(env: Env, taskId: number, body: Record<string, any>) {
  const rawEndpoint = await getConfig(env, "image_endpoint",
    await getConfig(env, "llm_endpoint", "https://api.openai.com/v1"));
  const endpoint = normalizeEndpoint(rawEndpoint);
  const apiKey = await getApiKey(env, "image_api_key") || await getApiKey(env, "llm_api_key");
  const model = await getConfig(env, "image_model", "dall-e-3");
  const size = body.size || "1024x1024";
  const imageProvider = await getConfig(env, "image_provider", "openai_image");
  const isImg2img = body.type === "img2img" || (Array.isArray(body.image) && body.image.length > 0);

  if (!apiKey) throw new Error("请先设置 IMAGE_API_KEY");

  const actualPrompt = body.prompt || body.keywords || "";
  if (!actualPrompt.trim()) throw new Error("缺少提示词");

  const qualitySuffix = ", natural body proportions, clearly defined limbs uncrossed, professional photography, highly detailed, masterpiece, sharp focus";
  const img2imgPrefix = isImg2img
    ? "Using the reference image as the base, make the following edits while preserving the subject's identity, pose, and composition: "
    : "";
  const finalPrompt = img2imgPrefix + actualPrompt + qualitySuffix;

  const useEditsEndpoint = isImg2img && imageProvider !== "agnes_image";
  const imgUrl = endpoint + (useEditsEndpoint ? "/images/edits" : "/images/generations");

  const reqBody: Record<string, any> = imageProvider === "agnes_image"
    ? { model, prompt: finalPrompt, size, extra_body: { response_format: "url" } }
    : { model, prompt: finalPrompt, size };

  if (isImg2img && body.image) {
    let images = Array.isArray(body.image) ? body.image : [body.image];

    if (env.IMAGES_BUCKET) {
      images = await Promise.all(images.map(async (img: string) => {
        if (img.startsWith("data:image/")) {
          const match = img.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i);
          if (match) {
            const contentType = match[1];
            const ext = contentType.split("/")[1] || "png";
            const binaryStr = atob(match[2]);
            const bytes = new Uint8Array(binaryStr.length);
            for (let index = 0; index < binaryStr.length; index++) bytes[index] = binaryStr.charCodeAt(index);
            const filename = crypto.randomUUID() + "." + ext;
            await env.IMAGES_BUCKET.put("images/" + filename, bytes.buffer, { httpMetadata: { contentType } });
            return "https://cf-text-to-image-ark.pages.dev/api/images?file=" + filename;
          }
        }
        return img;
      }));
    }

    if (imageProvider === "agnes_image") {
      if (!reqBody.extra_body) reqBody.extra_body = { response_format: "url" };
      reqBody.extra_body.image = images.length === 1 ? images[0] : images;
    } else {
      reqBody.image = images.length === 1 ? images[0] : images;
    }
  }

  logTask("request", {
    taskId,
    endpoint: imgUrl,
    provider: imageProvider,
    model,
    size,
    isImg2img,
    requestBody: JSON.stringify(reqBody),
  });

  const resp = await fetch(imgUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + apiKey },
    body: JSON.stringify(reqBody),
  });

  if (!resp.ok) {
    const txt = await resp.text();
    let err = txt;
    try { err = JSON.parse(txt).error?.message || txt; } catch {}
    logTask("image-api-error", { taskId, status: resp.status, responseBody: txt.substring(0, 1000) });
    throw new Error("生图失败(" + resp.status + "): " + err.substring(0, 200));
  }

  const data = await resp.json() as any;
  if (data.error) throw new Error("生图失败: " + (data.error.message || "未知错误"));

  const img = data.data?.[0];
  if (!img) throw new Error("生图返回为空");

  let bytes: ArrayBuffer;
  if (img.b64_json) bytes = Uint8Array.from(atob(img.b64_json), (char) => char.charCodeAt(0)).buffer;
  else if (img.url) bytes = await (await fetch(img.url)).arrayBuffer();
  else throw new Error("不支持的格式");

  const filename = crypto.randomUUID() + ".png";
  if (env.IMAGES_BUCKET) {
    await env.IMAGES_BUCKET.put("images/" + filename, bytes, { httpMetadata: { contentType: "image/png" } });
  }

  const imagePath = env.IMAGES_BUCKET ? "/api/images?file=" + filename :
    "data:image/png;base64," + btoa(String.fromCharCode(...new Uint8Array(bytes)));

  await env.DB.prepare(
    "INSERT INTO image_history (keyword_names, prompt, image_path, type, created_at, size) VALUES (?, ?, ?, 'image', ?, ?)"
  ).bind(body.keywords || "", body.prompt || actualPrompt, imagePath, new Date().toISOString(), body.size || "1024x1024").run();

  await env.DB.prepare(
    "UPDATE tasks SET status = 'completed', image_path = ?, progress = 100, error = '', updated_at = ? WHERE id = ?"
  ).bind(imagePath, new Date().toISOString(), taskId).run();
  logTask("completed", { taskId, imagePath });
}

async function processVideo(env: Env, taskId: number, body: Record<string, any>) {
  const rawEndpoint = await getConfig(env, "video_endpoint", "https://apihub.agnes-ai.com");
  const endpoint = normalizeEndpoint(rawEndpoint);
  const apiKey = await getApiKey(env, "video_api_key");
  const model = await getConfig(env, "video_model", "agnes-video-v2.0");

  if (!apiKey) throw new Error("请先设置 VIDEO_API_KEY");

  const actualPrompt = body.prompt || "";
  if (!actualPrompt.trim()) throw new Error("缺少提示词");

  const videoReqBody = {
    model,
    prompt: actualPrompt,
    width: body.width || 1920,
    height: body.height || 1080,
    num_frames: body.num_frames || 121,
    frame_rate: body.frame_rate || 24,
  };

  logTask("video-request", { taskId, endpoint: endpoint + "/videos/generations", model, requestBody: JSON.stringify(videoReqBody) });
  const resp = await fetch(endpoint + "/videos/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + apiKey },
    body: JSON.stringify(videoReqBody),
  });

  if (!resp.ok) {
    const txt = await resp.text();
    logTask("video-api-error", { taskId, status: resp.status, responseBody: txt.substring(0, 1000) });
    throw new Error("视频生成失败(" + resp.status + "): " + txt.substring(0, 200));
  }

  const data = await resp.json() as any;
  const videoUrl = data.url || data.video_url || "";
  const posterUrl = data.poster || data.thumbnail || "";

  await env.DB.prepare(
    "INSERT INTO image_history (keyword_names, prompt, image_path, type, poster_path, created_at) VALUES (?, ?, ?, 'video', ?, ?)"
  ).bind(body.keywords || "", actualPrompt, videoUrl, posterUrl, new Date().toISOString()).run();

  await env.DB.prepare(
    "UPDATE tasks SET status = 'completed', image_path = ?, poster_path = ?, progress = 100, error = '', updated_at = ? WHERE id = ?"
  ).bind(videoUrl, posterUrl, new Date().toISOString(), taskId).run();
  logTask("video-completed", { taskId, videoUrl });
}
