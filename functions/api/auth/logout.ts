import { ok } from "../../lib/http";
import { clearSessionCookie } from "../../lib/auth";

/** POST /api/auth/logout — 清除会话 Cookie。 */
export async function onRequestPost(): Promise<Response> {
  return ok(
    { authenticated: false },
    { headers: { "Set-Cookie": clearSessionCookie() } },
  );
}
