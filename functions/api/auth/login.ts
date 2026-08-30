import { createToken, AUTH_COOKIE, HttpError, isHttpError } from "../../auth";
import type { Env } from "../../db";

export async function onRequestPost(context: { request: Request; env: Env }) {
  const { request, env } = context;
  try {
    const { username, password } = await request.json() as { username?: string; password?: string };
    if (!username || !password) {
      return Response.json({ success: false, error: "用户名和密码不能为空" }, { status: 400 });
    }

    const user = await env.DB.prepare(
      "SELECT id, username, password_hash, role FROM users WHERE username = ?"
    ).bind(username).first<{ id: number; username: string; password_hash: string; role: string }>();

    const bcrypt = await import("bcryptjs");
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return Response.json({ success: false, error: "用户名或密码错误" }, { status: 401 });
    }

    const role = user.role === "admin" ? "admin" : "user";
    const token = await createToken(env, { userId: user.id, username: user.username, role });

    return Response.json(
      { success: true, data: { username: user.username } },
      { headers: { "Set-Cookie": AUTH_COOKIE(token) } },
    );
  } catch (e) {
    if (isHttpError(e)) return Response.json({ success: false, error: e.message }, { status: e.status });
    return Response.json({ success: false, error: "登录失败" }, { status: 500 });
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: { Allow: "POST, OPTIONS" } });
}
