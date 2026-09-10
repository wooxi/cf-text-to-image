import { handleError, ok, readJson, HttpError } from "../../lib/http";
import type { Env } from "../../lib/env";
import {
  createSessionToken,
  sessionCookie,
  verifyPassword,
} from "../../lib/auth";

/**
 * POST /api/auth/login — 单用户访问密码换会话 Cookie。
 */
export async function onRequestPost(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  try {
    const body = await readJson<{ password?: unknown }>(context.request);
    const password = typeof body.password === "string" ? body.password : "";
    if (!password) throw new HttpError(400, "请输入访问密码");

    if (!(await verifyPassword(context.env, password))) {
      throw new HttpError(401, "密码错误");
    }

    const token = await createSessionToken(context.env);
    return ok(
      { authenticated: true },
      { headers: { "Set-Cookie": sessionCookie(token) } },
    );
  } catch (e) {
    return handleError("auth:login", e, "登录失败");
  }
}
