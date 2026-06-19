import { SignJWT, jwtVerify } from "jose";

interface Env {
  JWT_SECRET: string;
}

export interface Session {
  userId: number;
  username: string;
}

function getSecret(env: Env): Uint8Array {
  const secret = env.JWT_SECRET || "cf-text-to-image-jwt-secret-CHANGE-ME";
  return new TextEncoder().encode(secret);
}

export async function createToken(env: Env, userId: number, username: string): Promise<string> {
  return new SignJWT({ userId, username })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(getSecret(env));
}

export async function verifyToken(env: Env, token: string): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(env));
    return payload as unknown as Session;
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
  if (!token) throw new Error("Unauthorized");
  const session = await verifyToken(env, token);
  if (!session) throw new Error("Unauthorized");
  return session;
}
