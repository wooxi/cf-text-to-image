import type {
  AuthState,
  ConfigStatus,
  HistoryPage,
  KeywordGroup,
  PingResult,
  TaskRecord,
} from "@/types";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

interface Envelope<T> {
  success: boolean;
  data?: T;
  error?: string;
}

const TIMEOUT_MS = 95_000;

/**
 * 会话失效的唯一处理入口：AuthProvider 在挂载时注册。
 * 这样各组件不必再层层传递 onUnauthorized，也不用各自判断 401。
 */
let handleUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  handleUnauthorized = handler;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(path, {
      credentials: "same-origin",
      ...init,
      headers: {
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
      signal: controller.signal,
    });
  } catch (e) {
    throw (e as Error).name === "AbortError"
      ? new ApiError(504, "请求超时，请稍后重试")
      : new ApiError(0, "网络错误，请检查连接");
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 401) {
    handleUnauthorized?.();
    throw new ApiError(401, "登录已失效，请重新输入访问密码");
  }

  const payload = (await response
    .json()
    .catch(() => null)) as Envelope<T> | null;
  if (!response.ok || !payload?.success) {
    throw new ApiError(
      response.status,
      payload?.error || `请求失败 (${response.status})`,
    );
  }
  return payload.data as T;
}

function send<T>(path: string, method: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export const api = {
  me: () => request<AuthState>("/api/auth/me"),
  login: (password: string) =>
    send<AuthState>("/api/auth/login", "POST", { password }),
  logout: () => send<{ authenticated: boolean }>("/api/auth/logout", "POST"),

  config: () => request<ConfigStatus>("/api/config"),
  ping: () => send<PingResult>("/api/config", "POST"),

  generatePrompt: (keywords: { name: string }[]) =>
    send<{ prompt: string }>("/api/generate-prompt", "POST", { keywords }),
  polish: (text: string) =>
    send<{ text: string }>("/api/polish", "POST", { text }),

  keywords: {
    list: () => request<KeywordGroup[]>("/api/keywords"),
    create: (
      body:
        | { groupId: number; name: string }
        | { name: string; slug: string; keywords: string[] },
    ) => send<{ id: number }>("/api/keywords", "POST", body),
    remove: (id: number) =>
      request<{ id: number }>(`/api/keywords?id=${id}`, { method: "DELETE" }),
    removeGroup: (id: number) =>
      request<{ groupId: number }>(`/api/keywords?group=${id}`, {
        method: "DELETE",
      }),
    reorder: (groupId: number, orderedIds: number[]) =>
      send<{ groupId: number }>("/api/keywords", "POST", {
        action: "reorder",
        groupId,
        orderedIds,
      }),
  },

  tasks: {
    list: (statuses: string[], limit = 50) =>
      request<TaskRecord[]>(
        `/api/tasks?status=${statuses.join(",")}&limit=${limit}`,
      ),
    create: (body: Record<string, unknown>) =>
      send<{ taskId: number }>("/api/tasks", "POST", body),
    retry: (id: number) => send<{ id: number }>("/api/tasks", "PUT", { id }),
    remove: (id: number) =>
      request<{ id: number }>(`/api/tasks?id=${id}`, { method: "DELETE" }),
  },

  history: {
    list: (limit = 30, before?: number) =>
      request<HistoryPage>(
        `/api/history?limit=${limit}${before ? `&before=${before}` : ""}`,
      ),
    remove: (id: number) =>
      request<{ id: number }>(`/api/history?id=${id}`, { method: "DELETE" }),
  },
};
