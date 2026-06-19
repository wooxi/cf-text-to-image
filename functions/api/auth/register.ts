import { createToken } from "../auth";
import type { Env } from "../db";

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
    if (username.length < 2 || password.length < 4) {
      return Response.json({ success: false, error: "用户名至少2位，密码至少4位" }, { status: 400 });
    }

    const existing = await env.DB.prepare("SELECT id FROM users WHERE username = ?").bind(username).first();
    if (existing) {
      return Response.json({ success: false, error: "用户名已存在" }, { status: 409 });
    }

    const bcrypt = await import("bcryptjs");
    const hash = bcrypt.hashSync(password, 10);
    const now = new Date().toISOString();

    const result = await env.DB.prepare(
      "INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)"
    ).bind(username, hash, now).run();

    const token = await createToken(env, result.meta.last_row_id as number, username);

    return new Response(JSON.stringify({ success: true, data: { username } }), {
      status: 201,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": `token=${token}; HttpOnly; Path=/; Max-Age=604800; SameSite=Lax`,
      },
    });
  } catch (e) {
    return Response.json({ success: false, error: "注册失败" }, { status: 500 });
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: { Allow: "POST, OPTIONS" } });
}
