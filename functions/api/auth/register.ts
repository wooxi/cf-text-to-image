import { createToken, AUTH_COOKIE, isHttpError } from "../../auth";
import type { Env } from "../../db";

export async function onRequestPost(context: { request: Request; env: Env }) {
  const { request, env } = context;
  try {
    if (env.ENABLE_REGISTRATION !== "true") {
      return Response.json({ success: false, error: "暂不开放注册" }, { status: 403 });
    }
    const { username, password } = await request.json() as { username?: string; password?: string };
    if (!username || !password) {
      return Response.json({ success: false, error: "用户名和密码不能为空" }, { status: 400 });
    }
    if (username.length < 2 || username.length > 32 || password.length < 8) {
      return Response.json({ success: false, error: "用户名 2-32 位，密码至少 8 位" }, { status: 400 });
    }

    const bcrypt = await import("bcryptjs");
    const hash = bcrypt.hashSync(password, 10);

    try {
      const result = await env.DB.prepare(
        "INSERT INTO users (username, password_hash, role, created_at) VALUES (?, ?, 'user', ?)"
      ).bind(username, hash, new Date().toISOString()).run();

      const token = await createToken(env, {
        userId: result.meta.last_row_id as number,
        username,
        role: "user",
      });

      return Response.json(
        { success: true, data: { username } },
        { status: 201, headers: { "Set-Cookie": AUTH_COOKIE(token) } },
      );
    } catch (e: any) {
      // UNIQUE constraint violation
      if (String(e?.message || "").includes("UNIQUE")) {
        return Response.json({ success: false, error: "用户名已存在" }, { status: 409 });
      }
      throw e;
    }
  } catch (e) {
    if (isHttpError(e)) return Response.json({ success: false, error: e.message }, { status: e.status });
    return Response.json({ success: false, error: "注册失败" }, { status: 500 });
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: { Allow: "POST, OPTIONS" } });
}
