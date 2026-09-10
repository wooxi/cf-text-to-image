import { ok } from "../../lib/http";
import type { Env } from "../../lib/env";
import { passwordConfigured, verifySessionToken } from "../../lib/auth";

/** GET /api/auth/me — 前端启动时判断是否需要显示密码门。 */
export async function onRequestGet(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  const match = (context.request.headers.get("Cookie") || "").match(
    /(?:^|;\s*)session=([^;]+)/,
  );
  const session = match
    ? await verifySessionToken(context.env, match[1])
    : null;

  return ok({
    authenticated: Boolean(session),
    passwordConfigured: passwordConfigured(context.env),
  });
}
