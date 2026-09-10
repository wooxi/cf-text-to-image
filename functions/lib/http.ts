export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "HttpError";
  }
}

export function ok<T>(data: T, init?: ResponseInit): Response {
  return Response.json({ success: true, data }, init);
}

export function fail(error: string, status = 500): Response {
  return Response.json({ success: false, error }, { status });
}

/**
 * 统一错误出口：HttpError 按其状态码原样返回；
 * 其余异常只记日志，对外给通用文案，不泄露内部细节。
 */
export function handleError(
  scope: string,
  e: unknown,
  fallback = "服务异常",
): Response {
  if (e instanceof HttpError) return fail(e.message, e.status);
  console.error(
    JSON.stringify({
      scope,
      event: "unhandled",
      error: e instanceof Error ? e.message : String(e),
    }),
  );
  return fail(fallback);
}

export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new HttpError(400, "请求体不是合法 JSON");
  }
}
