import { handleError, ok, HttpError } from "../lib/http";
import type { Env } from "../lib/env";
import { requireAuth } from "../lib/auth";
import { clampLimit } from "../lib/validate";
import { deleteImage } from "../lib/media";

const COLUMNS = "id, keyword_names, prompt, image_path, size, created_at";

interface HistoryRow {
  id: number;
  keyword_names: string;
  prompt: string;
  image_path: string;
  size: string;
  created_at: string;
}

/** GET /api/history?limit=30&before=<id> — 按 id 倒序的 keyset 分页。 */
export async function onRequestGet(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  try {
    await requireAuth(context.env, context.request);
    const url = new URL(context.request.url);
    const limit = clampLimit(url.searchParams.get("limit"), 30, 100);
    const before = Number(url.searchParams.get("before"));

    // 多取一条用来判断还有没有下一页
    const filter = before > 0 ? "WHERE id < ?" : "";
    const params = before > 0 ? [before, limit + 1] : [limit + 1];
    const [rowsResult, totalRow] = await Promise.all([
      context.env.DB.prepare(
        `SELECT ${COLUMNS} FROM image_history ${filter} ORDER BY id DESC LIMIT ?`,
      )
        .bind(...params)
        .all<HistoryRow>(),
      context.env.DB.prepare("SELECT COUNT(*) AS n FROM image_history").first<{
        n: number;
      }>(),
    ]);
    const rows = rowsResult.results;
    const hasMore = rows.length > limit;

    return ok({
      items: rows.slice(0, limit).map((row) => ({
        id: row.id,
        keywordNames: row.keyword_names,
        prompt: row.prompt,
        imagePath: row.image_path,
        size: row.size,
        createdAt: row.created_at,
      })),
      hasMore,
      nextBefore: hasMore ? rows[limit - 1].id : null,
      total: totalRow?.n ?? 0,
    });
  } catch (e) {
    return handleError("history:list", e, "获取历史失败");
  }
}

export async function onRequestDelete(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  try {
    await requireAuth(context.env, context.request);
    const id = Number(new URL(context.request.url).searchParams.get("id"));
    if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, "缺少ID");

    const record = await context.env.DB.prepare(
      "SELECT image_path FROM image_history WHERE id = ?",
    )
      .bind(id)
      .first<{ image_path: string }>();
    if (!record) throw new HttpError(404, "记录不存在");

    await context.env.DB.prepare("DELETE FROM image_history WHERE id = ?")
      .bind(id)
      .run();
    await deleteImage(context.env, record.image_path);
    return ok({ id });
  } catch (e) {
    return handleError("history:delete", e, "删除失败");
  }
}
