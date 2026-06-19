import { requireAuth } from "../../auth";
import type { Env } from "../../db";

export async function onRequestGet(context: { request: Request; env: Env }) {
  try {
    const session = await requireAuth(context.env, context.request);
    return Response.json({ success: true, data: session });
  } catch {
    return Response.json({ success: false, error: "未登录" }, { status: 401 });
  }
}
