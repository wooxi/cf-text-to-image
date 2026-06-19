import { createToken } from "../../auth";
import type { Env } from "../../db";

export async function onRequestPost(context: { request: Request; env: Env }) {
  const { request, env } = context;
  try {
    const { username, password } = await request.json() as { username?: string; password?: string };
    if (!username || !password) {
      return Response.json({ success: false, error: "用户名和密码不能为空" }, { status: 400 });
    }

    const user = await env.DB.prepare("SELECT * FROM users WHERE username = ?").bind(username).first();
    if (!user) {
      return Response.json({ success: false, error: "用户名或密码错误" }, { status: 401 });
    }

    // bcrypt in Workers: use Web Crypto or a pure-JS lib
    // For simplicity, use bcryptjs (pure JS, works in Workers)
    const bcrypt = await import("bcryptjs");
    const valid = bcrypt.compareSync(password, (user as any).password_hash);
    if (!valid) {
      return Response.json({ success: false, error: "用户名或密码错误" }, { status: 401 });
    }

    const token = await createToken(env, (user as any).id, (user as any).username);

    return new Response(JSON.stringify({ success: true, data: { username: (user as any).username } }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": `token=${token}; HttpOnly; Path=/; Max-Age=604800; SameSite=Lax`,
      },
    });
  } catch (e) {
    return Response.json({ success: false, error: "登录失败" }, { status: 500 });
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: { Allow: "POST, OPTIONS" } });
}
