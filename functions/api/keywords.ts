import { handleError, ok, readJson, HttpError } from "../lib/http";
import type { Env } from "../lib/env";
import { requireAuth } from "../lib/auth";

const MAX_NAME = 60;
const MAX_KEYWORDS_PER_GROUP = 200;
const SLUG = /^[a-z0-9][a-z0-9-]{0,48}$/;

interface GroupRow {
  id: number;
  name: string;
  slug: string;
  description: string;
  is_parameter_group: number;
}

function text(value: unknown, field: string, max = MAX_NAME): string {
  const result = typeof value === "string" ? value.trim() : "";
  if (!result) throw new HttpError(400, `${field}不能为空`);
  if (result.length > max) throw new HttpError(400, `${field}最长 ${max} 字`);
  return result;
}

function positiveInt(value: unknown, field: string): number {
  const result = Number(value);
  if (!Number.isInteger(result) || result <= 0)
    throw new HttpError(400, `缺少${field}`);
  return result;
}

function keywordNames(value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new HttpError(400, "keywords 必须是数组");
  const names = value.map((entry) => String(entry).trim()).filter(Boolean);
  if (names.length > MAX_KEYWORDS_PER_GROUP) {
    throw new HttpError(400, `单个分组最多 ${MAX_KEYWORDS_PER_GROUP} 个关键词`);
  }
  return names;
}

async function insertKeywords(
  env: Env,
  groupId: number,
  names: string[],
  offset = 0,
): Promise<void> {
  const now = new Date().toISOString();
  await env.DB.batch(
    names.map((name, index) =>
      env.DB.prepare(
        "INSERT INTO keywords (group_id, name, sort_order, created_at) VALUES (?, ?, ?, ?)",
      ).bind(groupId, name, offset + index + 1, now),
    ),
  );
}

/** GET /api/keywords — 全部分组与关键词。 */
export async function onRequestGet(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  try {
    await requireAuth(context.env, context.request);

    const [groups, keywords] = await Promise.all([
      context.env.DB.prepare(
        "SELECT id, name, slug, description, is_parameter_group FROM keyword_groups ORDER BY sort_order, id",
      ).all<GroupRow>(),
      context.env.DB.prepare(
        "SELECT id, name, group_id FROM keywords ORDER BY sort_order, id",
      ).all<{
        id: number;
        name: string;
        group_id: number;
      }>(),
    ]);

    const byGroup = new Map<number, { id: number; name: string }[]>();
    for (const keyword of keywords.results) {
      const list = byGroup.get(keyword.group_id);
      const item = { id: keyword.id, name: keyword.name };
      if (list) list.push(item);
      else byGroup.set(keyword.group_id, [item]);
    }

    return ok(
      groups.results.map((group) => ({
        id: group.id,
        name: group.name,
        slug: group.slug,
        description: group.description,
        isParameterGroup: Boolean(group.is_parameter_group),
        keywords: byGroup.get(group.id) ?? [],
      })),
    );
  } catch (e) {
    return handleError("keywords:list", e, "获取关键词失败");
  }
}

/** POST /api/keywords — 三选一：建分组 / 加关键词 / 组内排序。 */
export async function onRequestPost(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  try {
    await requireAuth(context.env, context.request);
    const body = await readJson<{
      action?: string;
      groupId?: unknown;
      name?: unknown;
      slug?: unknown;
      description?: unknown;
      keywords?: unknown;
      orderedIds?: unknown;
    }>(context.request);

    if (body.action === "reorder") {
      const groupId = positiveInt(body.groupId, "分组ID");
      if (!Array.isArray(body.orderedIds))
        throw new HttpError(400, "orderedIds 必须是数组");
      await context.env.DB.batch(
        body.orderedIds.map((value, index) =>
          context.env.DB.prepare(
            "UPDATE keywords SET sort_order = ? WHERE id = ? AND group_id = ?",
          ).bind(index + 1, positiveInt(value, "关键词ID"), groupId),
        ),
      );
      return ok({ groupId });
    }

    // 新建分组（可带初始关键词）
    if (body.slug !== undefined) {
      const slug = text(body.slug, "分组标识", 49);
      if (!SLUG.test(slug))
        throw new HttpError(400, "分组标识只能用小写字母、数字和连字符");

      const existing = await context.env.DB.prepare(
        "SELECT id FROM keyword_groups WHERE slug = ?",
      )
        .bind(slug)
        .first<{ id: number }>();
      if (existing) throw new HttpError(409, "该分组标识已存在");

      const { max } = (await context.env.DB.prepare(
        "SELECT COALESCE(MAX(sort_order), 0) AS max FROM keyword_groups",
      ).first<{
        max: number;
      }>()) ?? { max: 0 };

      const inserted = await context.env.DB.prepare(
        "INSERT INTO keyword_groups (name, slug, description, is_parameter_group, sort_order, created_at) " +
          "VALUES (?, ?, ?, 0, ?, ?)",
      )
        .bind(
          text(body.name, "分组名称"),
          slug,
          typeof body.description === "string"
            ? body.description.trim().slice(0, 200)
            : "",
          max + 1,
          new Date().toISOString(),
        )
        .run();

      const groupId = Number(inserted.meta.last_row_id);
      await insertKeywords(context.env, groupId, keywordNames(body.keywords));
      return ok({ id: groupId }, { status: 201 });
    }

    // 向已有分组追加一个关键词
    const groupId = positiveInt(body.groupId, "分组ID");
    const { count } = (await context.env.DB.prepare(
      "SELECT COUNT(*) AS count FROM keywords WHERE group_id = ?",
    )
      .bind(groupId)
      .first<{ count: number }>()) ?? { count: 0 };
    if (count >= MAX_KEYWORDS_PER_GROUP)
      throw new HttpError(400, "该分组关键词已达上限");

    // 必须回传真实 id，否则前端后续的排序/删除都会打在不存在的行上
    await insertKeywords(
      context.env,
      groupId,
      [text(body.name, "关键词")],
      count,
    );
    const created = await context.env.DB.prepare(
      "SELECT id FROM keywords WHERE group_id = ? ORDER BY id DESC LIMIT 1",
    )
      .bind(groupId)
      .first<{ id: number }>();

    return ok({ id: created?.id }, { status: 201 });
  } catch (e) {
    return handleError("keywords:create", e, "创建失败");
  }
}

/** DELETE /api/keywords?group=<id> 删除分组（连带关键词）；?id=<id> 删除单个关键词。 */
export async function onRequestDelete(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  try {
    await requireAuth(context.env, context.request);
    const params = new URL(context.request.url).searchParams;
    const groupId = Number(params.get("group"));
    const keywordId = Number(params.get("id"));

    if (Number.isInteger(groupId) && groupId > 0) {
      await context.env.DB.batch([
        context.env.DB.prepare("DELETE FROM keywords WHERE group_id = ?").bind(
          groupId,
        ),
        context.env.DB.prepare("DELETE FROM keyword_groups WHERE id = ?").bind(
          groupId,
        ),
      ]);
      return ok({ groupId });
    }

    if (Number.isInteger(keywordId) && keywordId > 0) {
      const deleted = await context.env.DB.prepare(
        "DELETE FROM keywords WHERE id = ?",
      )
        .bind(keywordId)
        .run();
      if (!deleted.meta.changes) throw new HttpError(404, "关键词不存在");
      return ok({ id: keywordId });
    }

    throw new HttpError(400, "缺少ID");
  } catch (e) {
    return handleError("keywords:delete", e, "删除失败");
  }
}
