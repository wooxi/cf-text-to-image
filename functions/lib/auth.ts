import { SignJWT, jwtVerify } from "jose";
import type { Env } from "./env";
import { HttpError } from "./http";
import { sessionSecret } from "./settings";

/**
 * 单用户鉴权：只有一个访问密码，没有用户表、没有角色、没有注册。
 *
 * 密码直接比对 ACCESS_PASSWORD（Cloudflare Secret，加密存储）。
 * 不做 PBKDF2/bcrypt 哈希——哈希的意义是「存储被读取后仍无法还原明文」，
 * 但 SESSION_SECRET 就躺在同一份环境变量里：拿到环境变量的人可以直接伪造会话 Cookie，
 * 哈希 ACCESS_PASSWORD 提供不了任何额外防护，只会带来盐值、迭代次数、
 * 缓存和哈希格式解析这一整套代码。
 */

const COOKIE_NAME = "session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 天

export interface Session {
  sub: "owner";
}

/** 环境变量优先；没配就用（或生成）库里那条，所以它不是必填项。 */
async function secret(env: Env): Promise<Uint8Array> {
  return new TextEncoder().encode(await sessionSecret(env));
}

export function passwordConfigured(env: Env): boolean {
  return Boolean(env.ACCESS_PASSWORD?.trim());
}

async function digest(value: string): Promise<Uint8Array> {
  return new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
  );
}

/**
 * 定长比较：两侧先各自做 SHA-256，长度必然相同，
 * 逐字节异或后一次性判断，不通过提前返回泄露前缀匹配长度。
 */
export async function verifyPassword(
  env: Env,
  submitted: string,
): Promise<boolean> {
  const configured = env.ACCESS_PASSWORD?.trim();
  if (!configured) throw new HttpError(500, "ACCESS_PASSWORD 未配置");

  const [a, b] = await Promise.all([digest(submitted), digest(configured)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function createSessionToken(env: Env): Promise<string> {
  return new SignJWT({ sub: "owner" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(await secret(env));
}

export async function verifySessionToken(
  env: Env,
  token: string,
): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, await secret(env), {
      algorithms: ["HS256"],
    });
    return payload.sub === "owner" ? { sub: "owner" } : null;
  } catch {
    return null;
  }
}

export function sessionCookie(token: string): string {
  return [
    `${COOKIE_NAME}=${token}`,
    "HttpOnly",
    "Secure",
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${SESSION_TTL_SECONDS}`,
  ].join("; ");
}

export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=0`;
}

/**
 * 会话 Cookie 是 SameSite=Lax，跨站发起的 POST/PUT/DELETE 不会携带它，
 * 因此状态变更接口不需要额外的 CSRF token 或 Origin 校验。
 */
export async function requireAuth(
  env: Env,
  request: Request,
): Promise<Session> {
  const match = (request.headers.get("Cookie") || "").match(
    /(?:^|;\s*)session=([^;]+)/,
  );
  const session = match ? await verifySessionToken(env, match[1]) : null;
  if (!session) throw new HttpError(401, "未登录");
  return session;
}
