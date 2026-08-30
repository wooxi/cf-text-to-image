import { getConfigs } from "./db";
import type { Env } from "./db";

interface TaskRow {
  id: number;
  status: string;
  type: string;
  keyword_names: string;
  prompt: string;
  size: string;
  reference_image: string;
  request_json: string;
}

/** 上游模型 API 返回的错误：任务标记 failed，不触发队列重试。 */
export class ModelApiError extends Error {}

const IMAGE_TIMEOUT_MS = 180_000;
const VIDEO_TIMEOUT_MS = 900_000;

export function normalizeEndpoint(endpoint: string): string {
  let url = endpoint.replace(/\/+$/, "");
  if (!/\/\/[^/]+\/.+/.test(url)) url += "/v1";
  return url;
}

function logTask(event: string, payload: Record<string, unknown>) {
  console.log(JSON.stringify({ scope: "task", event, ...payload }));
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function parseTaskBody(task: TaskRow): Record<string, any> {
  if (task.request_json) {
    return JSON.parse(task.request_json);
  }
  // request_json 上线前的历史任务，从列重建
  return {
    type: task.type,
    keywords: task.keyword_names,
    prompt: task.prompt,
    size: task.size,
    image: task.reference_image ? task.reference_image.split(",").filter(Boolean) : [],
  };
}

async function markTaskFailed(env: Env, taskId: number, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  logTask("task:fail", { taskId, error: message.slice(0, 500) });
  await env.DB.prepare(
    "UPDATE tasks SET status = 'failed', error = ?, progress = 0, updated_at = ? WHERE id = ?"
  ).bind(message.slice(0, 500), new Date().toISOString(), taskId).run();
}

/**
 * 处理一个任务。返回 true 表示任务已到达终态（completed/failed/skip）；
 * 抛出异常表示发生了基础设施错误，由调用方决定是否重投队列。
 */
export async function processTaskById(env: Env, taskId: number): Promise<boolean> {
  const task = await env.DB.prepare(
    "SELECT id, status, type, keyword_names, prompt, size, reference_image, request_json FROM tasks WHERE id = ?"
  ).bind(taskId).first<TaskRow>();

  if (!task) {
    logTask("task:missing", { taskId });
    return true;
  }
  if (task.status !== "pending" && task.status !== "failed") {
    logTask("task:skip", { taskId, status: task.status });
    return true;
  }

  // 乐观锁：仅 pending/failed 可被抢到，防止重复消费
  const lock = await env.DB.prepare(
    "UPDATE tasks SET status = 'processing', progress = 5, error = '', updated_at = ? WHERE id = ? AND status IN ('pending', 'failed')"
  ).bind(new Date().toISOString(), taskId).run();
  if ((lock.meta.changes || 0) === 0) {
    logTask("task:lock-skip", { taskId });
    return true;
  }

  const body = parseTaskBody(task);
  logTask("task:start", { taskId, type: body.type || task.type });

  try {
    if (body.type === "video") {
      await processVideo(env, taskId, body);
    } else {
      await processImage(env, taskId, body);
    }
    return true;
  } catch (error) {
    // 上游模型错误是预期失败，落库即可；其余（DB/存储/网络异常）向上抛，交给队列重试
    if (error instanceof ModelApiError) {
      await markTaskFailed(env, taskId, error);
      return true;
    }
    await markTaskFailed(env, taskId, error);
    throw error;
  }
}

async function processImage(env: Env, taskId: number, body: Record<string, any>) {
  const config = await getConfigs(env);
  const endpoint = normalizeEndpoint(config.image_endpoint || config.llm_endpoint || "https://api.openai.com/v1");
  const apiKey = config.image_api_key || config.llm_api_key;
  const model = config.image_model || "dall-e-3";
  const imageProvider = config.image_provider || "openai_image";
  const publicBaseUrl = config.public_base_url;
  const size = body.size || "1024x1024";

  if (!apiKey) throw new ModelApiError("请先在后台设置 image_api_key");

  const actualPrompt = (body.prompt || body.keywords || "").trim();
  if (!actualPrompt) throw new ModelApiError("缺少提示词");

  const isImg2img = body.type === "img2img" && Array.isArray(body.image) && body.image.length > 0;
  const qualitySuffix = ", natural body proportions, clearly defined limbs uncrossed, professional photography, highly detailed, masterpiece, sharp focus";
  const img2imgPrefix = isImg2img
    ? "Using the reference image as the base, make the following edits while preserving the subject's identity, pose, and composition: "
    : "";
  const finalPrompt = img2imgPrefix + actualPrompt + qualitySuffix;

  const imgUrl = endpoint + (isImg2img && imageProvider !== "agnes_image" ? "/images/edits" : "/images/generations");
  const reqBody: Record<string, any> = imageProvider === "agnes_image"
    ? { model, prompt: finalPrompt, size, extra_body: { response_format: "url" } }
    : { model, prompt: finalPrompt, size };

  if (isImg2img) {
    if (!publicBaseUrl) {
      throw new ModelApiError("参考图模式需要在后台设置 public_base_url（本站点的公网地址）");
    }
    const images = await Promise.all(body.image.map((img: string) => storeReferenceImage(env, img, publicBaseUrl)));
    if (imageProvider === "agnes_image") {
      reqBody.extra_body.image = images.length === 1 ? images[0] : images;
    } else {
      reqBody.image = images.length === 1 ? images[0] : images;
    }
  }

  logTask("→ image-req", { taskId, endpoint: imgUrl, provider: imageProvider, model, size, isImg2img });

  const resp = await fetchWithTimeout(imgUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + apiKey },
    body: JSON.stringify(reqBody),
  }, IMAGE_TIMEOUT_MS);

  if (!resp.ok) {
    const txt = await resp.text();
    logTask("← image-err", { taskId, status: resp.status, responseBody: txt.slice(0, 1000) });
    let message = txt;
    try { message = JSON.parse(txt).error?.message || txt; } catch {}
    throw new ModelApiError(`生图失败(${resp.status}): ${message.slice(0, 200)}`);
  }

  const data = await resp.json() as any;
  const img = data.data?.[0];
  if (!img) throw new ModelApiError("生图返回为空");

  let bytes: ArrayBuffer;
  if (img.b64_json) {
    bytes = Uint8Array.from(atob(img.b64_json), (c) => c.charCodeAt(0)).buffer;
  } else if (img.url) {
    bytes = await (await fetchWithTimeout(img.url, {}, IMAGE_TIMEOUT_MS)).arrayBuffer();
  } else {
    throw new ModelApiError("生图返回格式不支持（缺少 b64_json / url）");
  }

  const filename = crypto.randomUUID() + ".png";
  await env.IMAGES_BUCKET.put("images/" + filename, bytes, { httpMetadata: { contentType: "image/png" } });
  const imagePath = "/api/images?file=" + filename;

  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO image_history (keyword_names, prompt, image_path, type, created_at, size) VALUES (?, ?, ?, 'image', ?, ?)"
    ).bind(body.keywords || "", actualPrompt, imagePath, new Date().toISOString(), size),
    env.DB.prepare(
      "UPDATE tasks SET status = 'completed', image_path = ?, progress = 100, error = '', updated_at = ? WHERE id = ? AND status = 'processing'"
    ).bind(imagePath, new Date().toISOString(), taskId),
  ]);
  logTask("← image-ok", { taskId, imagePath });
}

/** 参考图统一存入 R2，向上游返回公网 URL。 */
async function storeReferenceImage(env: Env, img: string, publicBaseUrl: string): Promise<string> {
  if (!img.startsWith("data:image/")) return img; // 已经是公网 URL

  const match = img.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i);
  if (!match) throw new ModelApiError("参考图 Data URI 格式不正确");

  const contentType = match[1];
  const ext = contentType.split("/")[1] || "png";
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  const filename = crypto.randomUUID() + "." + ext;
  await env.IMAGES_BUCKET.put("images/" + filename, bytes.buffer, { httpMetadata: { contentType } });
  return publicBaseUrl.replace(/\/+$/, "") + "/api/images?file=" + filename;
}

async function processVideo(env: Env, taskId: number, body: Record<string, any>) {
  const config = await getConfigs(env);
  const endpoint = normalizeEndpoint(config.video_endpoint || "https://apihub.agnes-ai.com");
  const apiKey = config.video_api_key;
  const model = config.video_model || "agnes-video-v2.0";

  if (!apiKey) throw new ModelApiError("请先在后台设置 video_api_key");

  const actualPrompt = (body.prompt || "").trim();
  if (!actualPrompt) throw new ModelApiError("缺少提示词");

  const reqBody: Record<string, any> = {
    model,
    prompt: actualPrompt,
    width: body.width || 1920,
    height: body.height || 1080,
    num_frames: body.num_frames || 121,
    frame_rate: body.frame_rate || 24,
  };
  // 参考图/关键帧模式：把参考图（R2 公网 URL）传给上游
  if (Array.isArray(body.image) && body.image.length > 0) {
    if (!config.public_base_url) {
      throw new ModelApiError("参考图模式需要在后台设置 public_base_url（本站点的公网地址）");
    }
    const images = await Promise.all(body.image.map((img: string) => storeReferenceImage(env, img, config.public_base_url)));
    reqBody.image = images.length === 1 ? images[0] : images;
  }

  logTask("→ video-req", { taskId, endpoint: endpoint + "/videos/generations", model });

  const resp = await fetchWithTimeout(endpoint + "/videos/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + apiKey },
    body: JSON.stringify(reqBody),
  }, VIDEO_TIMEOUT_MS);

  if (!resp.ok) {
    const txt = await resp.text();
    logTask("← video-err", { taskId, status: resp.status, responseBody: txt.slice(0, 1000) });
    throw new ModelApiError(`视频生成失败(${resp.status}): ${txt.slice(0, 200)}`);
  }

  const data = await resp.json() as any;
  const videoUrl = data.url || data.video_url || "";
  if (!videoUrl) throw new ModelApiError("视频生成返回缺少 url 字段");
  const posterUrl = data.poster || data.thumbnail || "";

  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO image_history (keyword_names, prompt, image_path, type, poster_path, created_at) VALUES (?, ?, ?, 'video', ?, ?)"
    ).bind(body.keywords || "", actualPrompt, videoUrl, posterUrl, new Date().toISOString()),
    env.DB.prepare(
      "UPDATE tasks SET status = 'completed', image_path = ?, poster_path = ?, progress = 100, error = '', updated_at = ? WHERE id = ? AND status = 'processing'"
    ).bind(videoUrl, posterUrl, new Date().toISOString(), taskId),
  ]);
  logTask("← video-ok", { taskId, videoUrl });
}
