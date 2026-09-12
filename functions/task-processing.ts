import { getImageBedSettings, getImageSettings, loadConfig } from "./lib/env";
import type { Env } from "./lib/env";
import type { ImageBedSettings } from "./lib/env";
import { normalizeEndpoint } from "./lib/endpoints";
import { extForContentType, IMAGE_PREFIX, REF_PREFIX } from "./lib/media";
import { uploadToImageBed } from "./lib/imagebed";

/** 上游模型 API 返回的业务错误：任务落库为 failed，不触发队列重投。 */
export class ModelApiError extends Error {}

const IMAGE_TIMEOUT_MS = 180_000;
/** 超过此时长仍是 processing 的任务视为卡死，由每日定时任务收尸。 */
const STALE_PROCESSING_MS = 30 * 60 * 1000;
const REF_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** 任务参数全部来自 tasks 表的列，没有第二份 JSON 快照需要同步。 */
interface TaskRow {
  id: number;
  status: string;
  type: string;
  prompt: string;
  keyword_names: string;
  size: string;
  reference_image: string;
}

function logTask(event: string, payload: Record<string, unknown>) {
  console.log(JSON.stringify({ scope: "task", event, ...payload }));
}

async function markFailed(env: Env, taskId: number, error: unknown) {
  const message = (
    error instanceof Error ? error.message : String(error)
  ).slice(0, 500);
  logTask("task:fail", { taskId, error: message });
  await env.DB.prepare(
    "UPDATE tasks SET status = 'failed', error = ?, progress = 0, updated_at = ? WHERE id = ?",
  )
    .bind(message, new Date().toISOString(), taskId)
    .run();
}

/**
 * 处理一个任务。返回 true 表示已到终态（completed / failed / 跳过）；
 * 抛异常表示基础设施故障，由队列消费者决定是否重投。
 */
export async function processTaskById(
  env: Env,
  taskId: number,
): Promise<boolean> {
  const task = await env.DB.prepare(
    "SELECT id, status, type, prompt, keyword_names, size, reference_image FROM tasks WHERE id = ?",
  )
    .bind(taskId)
    .first<TaskRow>();

  if (!task) {
    logTask("task:missing", { taskId });
    return true;
  }
  if (task.status !== "pending" && task.status !== "failed") {
    logTask("task:skip", { taskId, status: task.status });
    return true;
  }

  // 乐观锁：只有仍处于 pending/failed 的那一次调用能抢到，防止重复消费
  const locked = await env.DB.prepare(
    "UPDATE tasks SET status = 'processing', progress = 10, error = '', updated_at = ? " +
      "WHERE id = ? AND status IN ('pending', 'failed')",
  )
    .bind(new Date().toISOString(), taskId)
    .run();
  if (!locked.meta.changes) {
    logTask("task:lock-skip", { taskId });
    return true;
  }

  try {
    logTask("task:start", { taskId, type: task.type });
    await processImage(env, taskId, task);
    return true;
  } catch (error) {
    // 上游错误是预期失败，落库即可；其余（D1/R2/网络）交给队列重投
    await markFailed(env, taskId, error);
    if (error instanceof ModelApiError) return true;
    throw error;
  }
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function readReference(
  env: Env,
  key: string,
): Promise<{ body: ArrayBuffer; contentType: string }> {
  const object = await env.IMAGES_BUCKET.get(key);
  if (!object) throw new ModelApiError("参考图已丢失，请重新提交");
  return {
    body: await object.arrayBuffer(),
    contentType: object.httpMetadata?.contentType || "image/png",
  };
}

async function processImage(env: Env, taskId: number, task: TaskRow) {
  const config = await loadConfig(env);
  const settings = getImageSettings(config);
  const isImg2img = task.type === "img2img";
  const referenceKeys = task.reference_image
    ? task.reference_image.split(",")
    : [];

  const actualPrompt = (task.prompt || task.keyword_names || "").trim();
  if (!actualPrompt) throw new ModelApiError("缺少提示词");

  const endpoint = normalizeEndpoint(settings.endpoint);
  const url = endpoint + (isImg2img ? "/images/edits" : "/images/generations");
  const headers = { Authorization: "Bearer " + settings.apiKey };

  let init: RequestInit;
  if (isImg2img) {
    // /images/edits 要求 multipart/form-data + 二进制文件，不是 JSON body
    const form = new FormData();
    form.append("model", settings.model);
    form.append("prompt", img2imgPrompt(actualPrompt));
    form.append("size", task.size);
    const refs = await Promise.all(
      referenceKeys.map((key) => readReference(env, key)),
    );
    refs.forEach((ref, index) => {
      const ext = extForContentType(ref.contentType) ?? "png";
      form.append(
        refs.length === 1 ? "image" : "image[]",
        new Blob([ref.body], { type: ref.contentType }),
        `ref-${index}.${ext}`,
      );
    });
    init = { method: "POST", headers, body: form };
  } else {
    init = {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: settings.model,
        prompt: actualPrompt + QUALITY_SUFFIX,
        size: task.size,
      }),
    };
  }

  logTask("image-req", {
    taskId,
    endpoint: url,
    model: settings.model,
    size: task.size,
    isImg2img,
  });

  const response = await fetchWithTimeout(url, init, IMAGE_TIMEOUT_MS);
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 1000);
    logTask("image-err", {
      taskId,
      status: response.status,
      responseBody: detail,
    });
    throw new ModelApiError(
      `生图失败(${response.status}): ${extractMessage(detail).slice(0, 200)}`,
    );
  }

  const data = (await response.json()) as {
    data?: { b64_json?: string; url?: string }[];
  };
  const image = data.data?.[0];
  if (!image) throw new ModelApiError("生图返回为空");

  const { bytes, contentType } = await readResult(image);
  const imagePath = await storeImage(
    env,
    bytes,
    contentType,
    getImageBedSettings(config),
  );
  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO image_history (keyword_names, prompt, image_path, size, created_at) VALUES (?, ?, ?, ?, ?)",
    ).bind(task.keyword_names, actualPrompt, imagePath, task.size, now),
    env.DB.prepare(
      "UPDATE tasks SET status = 'completed', image_path = ?, progress = 100, error = '', updated_at = ? " +
        "WHERE id = ? AND status = 'processing'",
    ).bind(imagePath, now, taskId),
  ]);
  logTask("image-ok", { taskId, imagePath });
}

/**
 * 生成结果落盘。
 *
 * 配了图床就传图床，入库的是可公开访问的外链，图库直接引用；
 * 没配图床（或图床临时故障）则落 R2，经 /api/images 代理读取。
 * 图床失败刻意不判任务失败——图已经在手上，退一步存 R2 比丢掉重生成划算。
 */
const IMAGE_BED_ATTEMPTS = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function storeImage(
  env: Env,
  bytes: Uint8Array,
  contentType: string,
  bed: ImageBedSettings | null,
): Promise<string> {
  if (bed) {
    // 图床偶发 530 / 源站 DNS 抖动，重试两次再决定回退——
    // 回退到 R2 的图不会丢，但会让图库链接形态不一致，能避免就避免
    for (let attempt = 1; attempt <= IMAGE_BED_ATTEMPTS; attempt++) {
      try {
        const url = await uploadToImageBed(bed, bytes, contentType);
        logTask("image-bed:ok", { url, attempt });
        return url;
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        const last = attempt === IMAGE_BED_ATTEMPTS;
        logTask(last ? "image-bed:fail" : "image-bed:retry", {
          attempt,
          error: detail,
        });
        if (!last) await sleep(600 * attempt);
      }
    }
  }

  const filename = `${crypto.randomUUID()}.${extForContentType(contentType) ?? "png"}`;
  await env.IMAGES_BUCKET.put(IMAGE_PREFIX + filename, bytes, {
    httpMetadata: { contentType },
  });
  return `/api/images?file=${filename}`;
}

const QUALITY_SUFFIX =
  ", natural body proportions, clearly defined limbs uncrossed, professional photography, highly detailed, masterpiece, sharp focus";

function img2imgPrompt(prompt: string): string {
  return (
    "Using the reference image as the base, make the following edits while preserving " +
    "the subject's identity, pose, and composition: " +
    prompt +
    QUALITY_SUFFIX
  );
}

/** 上游要么回 base64，要么回一个临时 URL；两种都归一成字节。 */
async function readResult(image: { b64_json?: string; url?: string }): Promise<{
  bytes: Uint8Array;
  contentType: string;
}> {
  if (image.b64_json) {
    const binary = atob(image.b64_json);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return { bytes, contentType: "image/png" };
  }
  if (!image.url)
    throw new ModelApiError("生图返回格式不支持（缺少 b64_json / url）");

  const response = await fetchWithTimeout(image.url, {}, IMAGE_TIMEOUT_MS);
  if (!response.ok)
    throw new ModelApiError(`下载生成结果失败(${response.status})`);
  const contentType =
    response.headers.get("content-type")?.split(";")[0].trim() || "image/png";
  return { bytes: new Uint8Array(await response.arrayBuffer()), contentType };
}

function extractMessage(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as {
      error?: { message?: string };
      message?: string;
    };
    return parsed.error?.message || parsed.message || raw;
  } catch {
    return raw;
  }
}

/** 每日定时：给卡死的任务收尸，并清理不再需要的参考图。 */
export async function runMaintenance(
  env: Env,
): Promise<{ staleTasks: number; refs: number }> {
  const now = new Date().toISOString();
  const swept = await env.DB.prepare(
    "UPDATE tasks SET status = 'failed', error = '任务超时未完成，已自动终止', progress = 0, updated_at = ? " +
      "WHERE status = 'processing' AND updated_at < ?",
  )
    .bind(now, new Date(Date.now() - STALE_PROCESSING_MS).toISOString())
    .run();

  const cutoff = Date.now() - REF_MAX_AGE_MS;
  const expired: string[] = [];
  let cursor: string | undefined;
  do {
    const listed = await env.IMAGES_BUCKET.list({
      prefix: REF_PREFIX,
      cursor,
      limit: 500,
    });
    for (const object of listed.objects) {
      if (object.uploaded.getTime() < cutoff) expired.push(object.key);
    }
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);

  if (expired.length) await env.IMAGES_BUCKET.delete(expired);

  const result = { staleTasks: swept.meta.changes || 0, refs: expired.length };
  logTask("maintenance", result);
  return result;
}
