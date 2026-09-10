import { HttpError } from "./http";
import { normalizeEndpoint } from "./endpoints";

export interface ChatRequest {
  endpoint: string;
  apiKey: string;
  model: string;
  system: string;
  user: string;
  timeoutMs?: number;
  temperature?: number;
  maxTokens?: number;
}

const DEFAULT_TIMEOUT_MS = 90_000;

/** 调用 OpenAI 兼容的 /chat/completions，返回纯文本内容。 */
export async function chatCompletion(req: ChatRequest): Promise<string> {
  const url = normalizeEndpoint(req.endpoint) + "/chat/completions";
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    req.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${req.apiKey}`,
      },
      body: JSON.stringify({
        model: req.model,
        messages: [
          { role: "system", content: req.system },
          { role: "user", content: req.user },
        ],
        temperature: req.temperature ?? 0.9,
        max_tokens: req.maxTokens ?? 4096,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error(
        JSON.stringify({
          scope: "llm",
          event: "upstream-error",
          status: response.status,
          detail: detail.slice(0, 500),
        }),
      );
      throw new HttpError(502, `模型调用失败 (${response.status})`);
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) throw new HttpError(502, "模型返回为空");
    return content;
  } catch (e) {
    if (e instanceof HttpError) throw e;
    if ((e as Error).name === "AbortError")
      throw new HttpError(504, "模型调用超时，请稍后重试");
    console.error(
      JSON.stringify({
        scope: "llm",
        event: "fetch-error",
        error: (e as Error).message,
      }),
    );
    throw new HttpError(502, "模型服务不可达");
  } finally {
    clearTimeout(timeout);
  }
}
