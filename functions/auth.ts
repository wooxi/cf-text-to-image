import { SignJWT, jwtVerify } from "jose";

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

interface Env {
  JWT_SECRET: string;
}

export interface Session {
  userId: number;
  username: string;
  role: "admin" | "user";
}

function getSecret(env: Env): Uint8Array {
  if (!env.JWT_SECRET) {
    throw new Error("JWT_SECRET 未配置，请在 Cloudflare 环境变量中设置");
  }
  return new TextEncoder().encode(env.JWT_SECRET);
}

export async function createToken(env: Env, session: Session): Promise<string> {
  return new SignJWT({ userId: session.userId, username: session.username, role: session.role })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(getSecret(env));
}

export async function verifyToken(env: Env, token: string): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(env));
    const { userId, username, role } = payload as unknown as Session;
    if (!userId || !username || (role !== "admin" && role !== "user")) return null;
    return { userId, username, role };
  } catch {
    return null;
  }
}

export function getTokenFromRequest(request: Request): string | null {
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(/token=([^;]+)/);
  return match ? match[1] : null;
}

export async function requireAuth(env: Env, request: Request): Promise<Session> {
  const token = getTokenFromRequest(request);
  const session = token ? await verifyToken(env, token) : null;
  if (!session) throw new HttpError(401, "未登录");
  return session;
}

export async function requireAdmin(env: Env, request: Request): Promise<Session> {
  const session = await requireAuth(env, request);
  if (session.role !== "admin") throw new HttpError(403, "需要管理员权限");
  return session;
}

export const AUTH_COOKIE = (token: string) =>
  `token=${token}; HttpOnly; Secure; Path=/; Max-Age=604800; SameSite=Lax`;

export function isHttpError(e: unknown): e is HttpError {
  return e instanceof HttpError;
}
