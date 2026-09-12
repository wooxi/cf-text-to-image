"use client";

import { useCallback, useEffect, useState } from "react";
import type { ImageRecord, KeywordGroup, SettingsPayload } from "@/types";
import { api, ApiError } from "@/lib/api";
import { useConfirm } from "../ConfirmDialog";
import { useToast } from "../Toast";

interface Props {
  groups: KeywordGroup[];
  reloadGroups: () => Promise<void>;
}

type Tab = "config" | "keywords" | "history";

const TABS: { key: Tab; label: string }[] = [
  { key: "config", label: "配置" },
  { key: "keywords", label: "关键词" },
  { key: "history", label: "生成历史" },
];

function Card({
  title,
  hint,
  children,
  onSave,
  saving,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  onSave?: () => void;
  saving?: boolean;
}) {
  return (
    <section
      className="overflow-hidden rounded-xl border"
      style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}
    >
      <div
        className="flex items-center justify-between gap-3 border-b px-4 py-2.5"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="min-w-0">
          <h3
            className="text-[13px] font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            {title}
          </h3>
          {hint && (
            <p className="mt-0.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
              {hint}
            </p>
          )}
        </div>
        {onSave && (
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="shrink-0 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-base disabled:opacity-50"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            {saving ? "保存中…" : "保存"}
          </button>
        )}
      </div>
      <div className="space-y-3 p-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  filled,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** 密钥字段：库里已有值，留空即不修改 */
  filled?: boolean;
  type?: "text" | "password";
}) {
  return (
    <label className="block">
      <span
        className="mb-1 flex items-center gap-2 text-[11px] font-medium"
        style={{ color: "var(--text-secondary)" }}
      >
        {label}
        {filled && (
          <span
            className="rounded-full px-1.5 py-px text-[10px] font-normal"
            style={{ background: "var(--success-bg)", color: "var(--success)" }}
          >
            已设置
          </span>
        )}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        className="w-full rounded-lg border px-3 py-2 font-mono text-xs outline-none transition-base focus:border-[var(--accent)]"
        style={{
          borderColor: "var(--border)",
          background: "var(--bg-tertiary)",
          color: "var(--text-primary)",
        }}
      />
    </label>
  );
}

/** 配置：模型接口、图床、提示词，都是登录后在这里改，存在 D1。 */
function ConfigTab() {
  const toast = useToast();
  const [form, setForm] = useState<Record<string, string>>({});
  const [secrets, setSecrets] = useState<Record<string, boolean>>({});
  const [missing, setMissing] = useState<string[]>([]);
  const [saving, setSaving] = useState<string | null>(null);
  const [pinging, setPinging] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.settings.get();
      setForm(data.values);
      setSecrets(data.secrets);
      setMissing(data.missing);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "读取配置失败");
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const set = (key: string) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  /** 密钥留空表示不修改（传 null），其余字段原样提交 */
  const save = async (card: string, keys: string[], secretKeys: string[]) => {
    setSaving(card);
    try {
      const payload: Record<string, string | null> = {};
      for (const key of keys) {
        const value = (form[key] ?? "").trim();
        payload[key] = secretKeys.includes(key)
          ? value || null
          : value;
      }
      await api.settings.save(payload);
      toast.success("已保存");
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "保存失败");
    } finally {
      setSaving(null);
    }
  };

  const ping = async () => {
    setPinging(true);
    try {
      const result = await api.settings.ping();
      if (result.reachable)
        toast.success(`端点可达，返回 ${result.models?.length ?? 0} 个模型`);
      else toast.error(`端点返回 ${result.status}`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "检测失败");
    } finally {
      setPinging(false);
    }
  };

  return (
    <div className="space-y-4">
      {missing.length > 0 && (
        <p
          className="rounded-lg border px-3.5 py-2.5 text-xs leading-relaxed"
          style={{
            borderColor: "var(--danger)",
            background: "var(--danger-bg)",
            color: "var(--danger)",
          }}
        >
          还差 {missing.join("、")} 没填，填完才能出图。
        </p>
      )}

      <Card
        title="LLM 接口"
        hint="生成提示词 / 润色用，OpenAI 兼容"
        onSave={() =>
          void save(
            "llm",
            ["llm_endpoint", "llm_api_key", "llm_model"],
            ["llm_api_key"],
          )
        }
        saving={saving === "llm"}
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Field
          label="接口地址"
          value={form.llm_endpoint ?? ""}
          onChange={set("llm_endpoint")}
          placeholder="https://api.openai.com/v1"
        />
        <Field
          label="API Key"
          type="password"
          value={form.llm_api_key ?? ""}
          onChange={set("llm_api_key")}
          filled={secrets.llm_api_key}
          placeholder={
            secrets.llm_api_key ? "留空则不修改" : "sk-…"
          }
        />
        <Field
          label="模型"
          value={form.llm_model ?? ""}
          onChange={set("llm_model")}
          placeholder="gpt-4o"
        />
        </div>
      </Card>

      <Card
        title="图像接口"
        hint="出图用，OpenAI 兼容"
        onSave={() =>
          void save(
            "image",
            ["image_endpoint", "image_api_key", "image_model"],
            ["image_api_key"],
          )
        }
        saving={saving === "image"}
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Field
          label="接口地址"
          value={form.image_endpoint ?? ""}
          onChange={set("image_endpoint")}
          placeholder="https://api.openai.com/v1"
        />
        <Field
          label="API Key"
          type="password"
          value={form.image_api_key ?? ""}
          onChange={set("image_api_key")}
          filled={secrets.image_api_key}
          placeholder={secrets.image_api_key ? "留空则不修改" : "sk-…"}
        />
        <Field
          label="模型"
          value={form.image_model ?? ""}
          onChange={set("image_model")}
          placeholder="gpt-image-1"
        />
        </div>
      </Card>

      <Card
        title="图床"
        hint="可留空：留空则成品图存 R2，由本站鉴权代理读取"
        onSave={() =>
          void save(
            "bed",
            [
              "image_bed_endpoint",
              "image_bed_auth_code",
              "image_bed_channel",
            ],
            ["image_bed_auth_code"],
          )
        }
        saving={saving === "bed"}
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Field
          label="图床地址"
          value={form.image_bed_endpoint ?? ""}
          onChange={set("image_bed_endpoint")}
          placeholder="https://imgbed.example.com"
        />
        <Field
          label="上传认证码"
          type="password"
          value={form.image_bed_auth_code ?? ""}
          onChange={set("image_bed_auth_code")}
          filled={secrets.image_bed_auth_code}
          placeholder={secrets.image_bed_auth_code ? "留空则不修改" : "图床后台的 authCode"}
        />
        <Field
          label="存储渠道"
          value={form.image_bed_channel ?? ""}
          onChange={set("image_bed_channel")}
          placeholder="cfr2（原图无损；telegram 等渠道会压缩）"
        />
        </div>
      </Card>

      <Card
        title="系统提示词"
        hint="留空则用内置那份；也可以用「测试连通性」顺带确认密钥有效"
        onSave={() =>
          void save(
            "prompt",
            ["prompt_system_image", "prompt_system_polish"],
            [],
          )
        }
        saving={saving === "prompt"}
      >
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => void ping()}
            disabled={pinging}
            className="rounded-lg border px-3 py-1.5 text-[11px] font-medium transition-base hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
          >
            {pinging ? "检测中…" : "测试连通性"}
          </button>
        </div>
        {(
          [
            ["prompt_system_image", "出图提示词"],
            ["prompt_system_polish", "润色提示词"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="block">
            <span
              className="mb-1 flex items-center justify-between text-[11px] font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              {label}
              <span className="tabular-nums" style={{ color: "var(--text-muted)" }}>
                {(form[key] ?? "").length} 字
              </span>
            </span>
            <textarea
              value={form[key] ?? ""}
              onChange={(e) => set(key)(e.target.value)}
              rows={6}
              spellCheck={false}
              className="w-full resize-y rounded-lg border px-3 py-2 text-xs leading-relaxed outline-none transition-base focus:border-[var(--accent)]"
              style={{
                borderColor: "var(--border)",
                background: "var(--bg-tertiary)",
                color: "var(--text-primary)",
              }}
            />
          </label>
        ))}
      </Card>
    </div>
  );
}

/** 关键词：左边选分组，右边管这个词表——加词、改名、排序、删除都在一处。 */
function KeywordsTab({ groups, reloadGroups }: Props) {
  const toast = useToast();
  const confirm = useConfirm();
  const [activeId, setActiveId] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [groupDraft, setGroupDraft] = useState({ name: "", slug: "" });

  const active = groups.find((g) => g.id === activeId) ?? groups[0] ?? null;

  const run = useCallback(
    async (fn: () => Promise<unknown>, done?: string) => {
      setBusy(true);
      try {
        await fn();
        if (done) toast.success(done);
        await reloadGroups();
      } catch (e) {
        toast.error(e instanceof ApiError ? e.message : "操作失败");
      } finally {
        setBusy(false);
      }
    },
    [reloadGroups, toast],
  );

  const addKeywords = async () => {
    if (!active) return;
    const names = draft
      .split(/[\n,，、]/)
      .map((name) => name.trim())
      .filter(Boolean);
    if (!names.length) return;
    await run(async () => {
      for (const name of names) {
        await api.keywords.create({ groupId: active.id, name });
      }
      setDraft("");
    }, `加了 ${names.length} 个词`);
  };

  const move = async (keywordId: number, delta: number) => {
    if (!active) return;
    const ids = active.keywords.map((k) => k.id);
    const from = ids.indexOf(keywordId);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= ids.length) return;
    [ids[from], ids[to]] = [ids[to], ids[from]];
    await run(() => api.keywords.reorder(active.id, ids));
  };

  const filtered = active
    ? query.trim()
      ? active.keywords.filter((k) =>
          k.name.toLowerCase().includes(query.trim().toLowerCase()),
        )
      : active.keywords
    : [];

  return (
    <div className="grid gap-4 lg:grid-cols-[200px_1fr]">
      <aside className="space-y-1">
        {groups.map((group) => {
          const on = active?.id === group.id;
          return (
            <button
              key={group.id}
              type="button"
              onClick={() => setActiveId(group.id)}
              className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-[13px] transition-base"
              style={{
                background: on ? "var(--accent-light)" : "transparent",
                color: on ? "var(--accent)" : "var(--text-secondary)",
              }}
            >
              <span className="truncate">{group.name}</span>
              <span className="shrink-0 text-[10px] tabular-nums opacity-70">
                {group.keywords.length}
              </span>
            </button>
          );
        })}

        {adding ? (
          <div
            className="space-y-1.5 rounded-lg border p-2.5"
            style={{ borderColor: "var(--border)" }}
          >
            <input
              value={groupDraft.name}
              onChange={(e) =>
                setGroupDraft((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="分组名"
              className="w-full rounded-md border px-2 py-1.5 text-xs outline-none focus:border-[var(--accent)]"
              style={{
                borderColor: "var(--border)",
                background: "var(--bg-tertiary)",
                color: "var(--text-primary)",
              }}
            />
            <input
              value={groupDraft.slug}
              onChange={(e) =>
                setGroupDraft((prev) => ({ ...prev, slug: e.target.value }))
              }
              placeholder="英文标识"
              className="w-full rounded-md border px-2 py-1.5 font-mono text-xs outline-none focus:border-[var(--accent)]"
              style={{
                borderColor: "var(--border)",
                background: "var(--bg-tertiary)",
                color: "var(--text-primary)",
              }}
            />
            <div className="flex gap-1.5">
              <button
                type="button"
                disabled={busy || !groupDraft.name.trim() || !groupDraft.slug.trim()}
                onClick={() =>
                  void run(async () => {
                    await api.keywords.create({
                      name: groupDraft.name.trim(),
                      slug: groupDraft.slug.trim(),
                      keywords: [],
                    });
                    setGroupDraft({ name: "", slug: "" });
                    setAdding(false);
                  }, "分组已创建")
                }
                className="flex-1 rounded-md py-1.5 text-[11px] font-medium disabled:opacity-40"
                style={{ background: "var(--accent)", color: "#fff" }}
              >
                创建
              </button>
              <button
                type="button"
                onClick={() => setAdding(false)}
                className="rounded-md border px-2.5 py-1.5 text-[11px]"
                style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
              >
                取消
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="w-full rounded-lg border border-dashed px-3 py-2 text-[12px] transition-base hover:border-[var(--accent)] hover:text-[var(--accent)]"
            style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
          >
            + 新建分组
          </button>
        )}
      </aside>

      {active ? (
        <section
          className="overflow-hidden rounded-xl border"
          style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}
        >
          <div
            className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5"
            style={{ borderColor: "var(--border)" }}
          >
            <div className="flex min-w-0 items-baseline gap-2">
              <h3
                className="text-[13px] font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                {active.name}
              </h3>
              <code className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                {active.slug}
              </code>
              <span
                className="text-[11px] tabular-nums"
                style={{ color: "var(--text-muted)" }}
              >
                {active.keywords.length} 个
              </span>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                if (
                  await confirm({
                    title: `删除分组「${active.name}」？`,
                    message: `组内 ${active.keywords.length} 个关键词会一并删除。`,
                    confirmLabel: "删除",
                    danger: true,
                  })
                ) {
                  await run(() => api.keywords.removeGroup(active.id), "分组已删除");
                  setActiveId(null);
                }
              }}
              className="text-[11px] transition-base hover:opacity-80"
              style={{ color: "var(--danger)" }}
            >
              删除分组
            </button>
          </div>

          <div className="space-y-3 p-4">
            <div className="flex flex-wrap gap-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索本组关键词…"
                className="min-w-[8rem] flex-1 rounded-lg border px-3 py-2 text-xs outline-none focus:border-[var(--accent)]"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--bg-tertiary)",
                  color: "var(--text-primary)",
                }}
              />
            </div>

            <div className="flex gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void addKeywords();
                  }
                }}
                placeholder="输入关键词，回车添加（支持逗号 / 换行一次加多个）"
                className="flex-1 rounded-lg border px-3 py-2 text-xs outline-none focus:border-[var(--accent)]"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--bg-tertiary)",
                  color: "var(--text-primary)",
                }}
              />
              <button
                type="button"
                disabled={busy || !draft.trim()}
                onClick={() => void addKeywords()}
                className="rounded-lg px-4 py-2 text-xs font-medium disabled:opacity-40"
                style={{ background: "var(--accent)", color: "#fff" }}
              >
                添加
              </button>
            </div>

            <div className="grid gap-1 sm:grid-cols-2">
              {filtered.map((keyword) => {
                const index = active.keywords.indexOf(keyword);
                return (
                  <div
                    key={keyword.id}
                    className="group flex items-center gap-1 rounded-lg border px-2.5 py-1.5"
                    style={{
                      borderColor: "var(--border)",
                      background: "var(--bg-tertiary)",
                    }}
                  >
                    <span className="flex-1 truncate text-xs">
                      {keyword.name}
                    </span>
                    <button
                      type="button"
                      disabled={busy || index === 0}
                      onClick={() => void move(keyword.id, -1)}
                      title="上移"
                      className="rounded px-1 text-[11px] opacity-40 transition-base hover:opacity-100 disabled:opacity-10"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={busy || index === active.keywords.length - 1}
                      onClick={() => void move(keyword.id, 1)}
                      title="下移"
                      className="rounded px-1 text-[11px] opacity-40 transition-base hover:opacity-100 disabled:opacity-10"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void run(() => api.keywords.remove(keyword.id))}
                      title="删除"
                      className="rounded px-1 text-[11px] opacity-40 transition-base hover:opacity-100"
                      style={{ color: "var(--danger)" }}
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
              {filtered.length === 0 && (
                <p
                  className="col-span-full py-6 text-center text-xs"
                  style={{ color: "var(--text-muted)" }}
                >
                  {query.trim() ? "没有匹配的关键词" : "这个词表还是空的，上面输入框加几个"}
                </p>
              )}
            </div>
          </div>
        </section>
      ) : (
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          左边还没有分组
        </p>
      )}
    </div>
  );
}

function HistoryTab() {
  const toast = useToast();
  const confirm = useConfirm();
  const [items, setItems] = useState<ImageRecord[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [nextBefore, setNextBefore] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (before?: number) => {
      setLoading(true);
      try {
        const page = await api.history.list(30, before);
        setItems((prev) => (before ? [...prev, ...page.items] : page.items));
        setHasMore(page.hasMore);
        setNextBefore(page.nextBefore);
      } catch (e) {
        toast.error(e instanceof ApiError ? e.message : "加载失败");
      } finally {
        setLoading(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const remove = async (record: ImageRecord) => {
    const confirmed = await confirm({
      title: "删除这条记录？",
      message: "对应的图片文件也会一并删除，不可撤销。",
      confirmLabel: "删除",
      danger: true,
    });
    if (!confirmed) return;
    try {
      await api.history.remove(record.id);
      setItems((prev) => prev.filter((item) => item.id !== record.id));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "删除失败");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          已载入 {items.length} 条
        </p>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg border px-3 py-1.5 text-xs font-medium transition-base hover:border-[var(--border-hover)]"
          style={{
            borderColor: "var(--border)",
            color: "var(--text-secondary)",
          }}
        >
          刷新
        </button>
      </div>

      {loading && items.length === 0 && (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          加载中…
        </p>
      )}
      {!loading && items.length === 0 && (
        <p
          className="py-10 text-center text-sm"
          style={{ color: "var(--text-muted)" }}
        >
          暂无生成记录
        </p>
      )}

      <ul className="space-y-2">
        {items.map((record) => (
          <li
            key={record.id}
            className="flex gap-3 rounded-lg border p-3"
            style={{
              borderColor: "var(--border)",
              background: "var(--bg-secondary)",
            }}
          >
            <a
              href={record.imagePath}
              target="_blank"
              rel="noopener noreferrer"
              className="h-16 w-16 shrink-0 overflow-hidden rounded-md"
              style={{ background: "var(--bg-tertiary)" }}
            >
              <img
                src={record.imagePath}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </a>
            <div className="min-w-0 flex-1">
              <div
                className="flex items-center gap-2 text-[10px]"
                style={{ color: "var(--text-muted)" }}
              >
                <span className="tabular-nums">#{record.id}</span>
                {record.size && (
                  <span className="tabular-nums">{record.size}</span>
                )}
                <span>
                  {new Date(record.createdAt).toLocaleString("zh-CN")}
                </span>
              </div>
              <p
                className="mt-1 line-clamp-2 text-xs leading-relaxed"
                style={{ color: "var(--text-secondary)" }}
              >
                {record.prompt || record.keywordNames || "（无描述）"}
              </p>
              <div className="mt-1.5 flex gap-3 text-[11px]">
                <a
                  href={record.imagePath}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "var(--accent)" }}
                >
                  查看原图
                </a>
                <button
                  type="button"
                  onClick={() => void remove(record)}
                  style={{ color: "var(--danger)" }}
                >
                  删除
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {hasMore && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={() => void load(nextBefore ?? undefined)}
            disabled={loading}
            className="rounded-lg border px-5 py-2 text-xs font-medium transition-base hover:border-[var(--border-hover)] disabled:opacity-50"
            style={{
              borderColor: "var(--border)",
              color: "var(--text-secondary)",
            }}
          >
            {loading ? "加载中…" : "加载更多"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function SettingsPanel(props: Props) {
  const [tab, setTab] = useState<Tab>("config");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        className="shrink-0 border-b backdrop-blur-xl"
        style={{
          borderColor: "var(--border)",
          background: "var(--bg-elevated, var(--bg-secondary))",
        }}
      >
        <div className="mx-auto flex w-full max-w-5xl gap-6 px-4 lg:px-6 2xl:max-w-6xl">
          {TABS.map((item) => {
            const active = tab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setTab(item.key)}
                aria-current={active ? "page" : undefined}
                className="relative -mb-px border-b-2 py-3 text-[13px] font-medium transition-base"
                style={{
                  borderColor: active ? "var(--accent)" : "transparent",
                  color: active ? "var(--accent)" : "var(--text-secondary)",
                }}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="scroll-touch min-h-0 flex-1 overflow-y-auto px-4 py-4 lg:px-6 lg:py-5">
        <div className="mx-auto w-full max-w-5xl 2xl:max-w-6xl">
        {tab === "config" && <ConfigTab />}
        {tab === "keywords" && <KeywordsTab {...props} />}
        {tab === "history" && <HistoryTab />}
        </div>
      </div>
    </div>
  );
}
