"use client";

import { useCallback, useEffect, useState } from "react";
import type { ConfigStatus, ImageRecord, KeywordGroup } from "@/types";
import { api, ApiError } from "@/lib/api";
import { useConfirm } from "../ConfirmDialog";
import { useToast } from "../Toast";

interface Props {
  groups: KeywordGroup[];
  reloadGroups: () => Promise<void>;
}

type Tab = "status" | "keywords" | "history";

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "status", label: "运行状态", icon: "🩺" },
  { key: "keywords", label: "关键词", icon: "🏷️" },
  { key: "history", label: "生成历史", icon: "📋" },
];

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <section
      className="rounded-xl border p-4"
      style={{
        borderColor: "var(--border)",
        background: "var(--bg-secondary)",
      }}
    >
      {children}
    </section>
  );
}

function StatusTab() {
  const toast = useToast();
  const [status, setStatus] = useState<ConfigStatus | null>(null);
  const [pinging, setPinging] = useState(false);

  useEffect(() => {
    api
      .config()
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  const ping = async () => {
    setPinging(true);
    try {
      const result = await api.ping();
      if (result.reachable)
        toast.success(`端点可达，返回 ${result.models?.length ?? 0} 个模型`);
      else toast.error(`端点返回 ${result.status}`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "检测失败");
    } finally {
      setPinging(false);
    }
  };

  if (!status)
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        读取中…
      </p>
    );

  const missing = new Set(status.missing);

  return (
    <div className="space-y-5">
      <div
        className="rounded-xl border px-4 py-3 text-xs leading-relaxed"
        style={{
          borderColor: "var(--border)",
          background: "var(--bg-tertiary)",
          color: "var(--text-secondary)",
        }}
      >
        所有配置与密钥都来自 Cloudflare 的环境变量（控制台 → Workers &amp; Pages →
        cf-text-to-image → Settings → Variables and Secrets）。
        系统内不存储也不能修改它们；改了之后重新部署一次即生效。
      </div>

      <section>
        <h3
          className="mb-2 text-sm font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          环境变量
        </h3>
        <div className="space-y-1.5">
          {status.required.map(({ key, scope }) => {
            const ok = !missing.has(key);
            return (
              <div
                key={key}
                className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--bg-secondary)",
                }}
              >
                <div className="min-w-0">
                  <code
                    className="text-xs font-mono"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {key}
                  </code>
                  <p
                    className="text-[10px]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {scope}
                  </p>
                </div>
                <span
                  className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium"
                  style={{
                    background: ok ? "var(--success-bg)" : "var(--danger-bg)",
                    color: ok ? "var(--success)" : "var(--danger)",
                  }}
                >
                  {ok ? "✓ 已配置" : "✗ 缺失"}
                </span>
              </div>
            );
          })}
        </div>
        {status.missing.length > 0 && (
          <p className="mt-2 text-xs" style={{ color: "var(--danger)" }}>
            缺少 {status.missing.join("、")}，服务无法正常工作。
          </p>
        )}

        <h3
          className="mb-2 mt-4 text-sm font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          可选变量
        </h3>
        <div className="space-y-1.5">
          {status.optional.map(({ key, scope }) => {
            const configured = Boolean(status.optionalSet?.[key]);
            return (
              <div
                key={key}
                className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--bg-secondary)",
                }}
              >
                <div className="min-w-0">
                  <code
                    className="text-xs font-mono"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {key}
                  </code>
                  <p
                    className="text-[10px]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {scope} · 不配则成品图存 R2
                  </p>
                </div>
                <span
                  className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium"
                  style={{
                    background: configured
                      ? "var(--success-bg)"
                      : "var(--bg-tertiary)",
                    color: configured ? "var(--success)" : "var(--text-muted)",
                  }}
                >
                  {configured ? "✓ 已配置" : "未配置"}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3
            className="text-sm font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            当前生效值
          </h3>
          <button
            type="button"
            onClick={() => void ping()}
            disabled={pinging}
            className="rounded-lg border px-3 py-1.5 text-xs font-medium transition-base hover:border-[var(--accent)] disabled:opacity-50"
            style={{ borderColor: "var(--border)", color: "var(--accent)" }}
          >
            {pinging ? "检测中…" : "测试连通性"}
          </button>
        </div>
        <dl className="space-y-1.5">
          {(
            [
              ["LLM 端点", status.resolved.llmEndpoint],
              ["LLM 模型", status.resolved.llmModel],
              ["图像端点", status.resolved.imageEndpoint],
              ["图像模型", status.resolved.imageModel],
              [
                "成品图存放",
                status.storage === "image-bed"
                  ? `图床 ${status.resolved.imageBedEndpoint}`.trim()
                  : "本站 R2",
              ],
            ] as const
          ).map(([label, value]) => (
            <div
              key={label}
              className="flex items-baseline justify-between gap-3 text-xs"
            >
              <dt className="shrink-0" style={{ color: "var(--text-muted)" }}>
                {label}
              </dt>
              <dd
                className="truncate font-mono"
                style={{ color: "var(--text-secondary)" }}
                title={value || "（未配置）"}
              >
                {value || "（未配置）"}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="space-y-3">
        <h3
          className="text-sm font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          生效中的系统提示词
        </h3>
        {(
          [
            [
              "PROMPT_SYSTEM_IMAGE",
              status.resolved.promptSystemImage,
              status.overrides.image,
            ],
            [
              "PROMPT_SYSTEM_POLISH",
              status.resolved.promptSystemPolish,
              status.overrides.polish,
            ],
          ] as const
        ).map(([key, value, overridden]) => (
          <Panel key={key}>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <code
                className="text-[11px] font-mono"
                style={{ color: "var(--text-muted)" }}
              >
                {key}
              </code>
              <span
                className="text-[10px]"
                style={{
                  color: overridden ? "var(--accent)" : "var(--text-muted)",
                }}
              >
                {overridden ? "已被环境变量覆盖" : "使用内置默认"}
              </span>
            </div>
            <p
              className="max-h-32 overflow-y-auto whitespace-pre-wrap break-words text-[11px] leading-relaxed"
              style={{ color: "var(--text-secondary)" }}
            >
              {value}
            </p>
          </Panel>
        ))}
      </section>
    </div>
  );
}

function KeywordsTab({ groups, reloadGroups }: Props) {
  const toast = useToast();
  const confirm = useConfirm();
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [draftGroup, setDraftGroup] = useState({
    name: "",
    slug: "",
    keywords: "",
  });
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "操作失败");
    } finally {
      setBusy(false);
    }
  };

  const addKeyword = (group: KeywordGroup) => {
    const name = (drafts[group.id] ?? "").trim();
    if (!name) return;
    void run(async () => {
      await api.keywords.create({ groupId: group.id, name });
      setDrafts((prev) => ({ ...prev, [group.id]: "" }));
      await reloadGroups();
    });
  };

  const move = (group: KeywordGroup, index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= group.keywords.length) return;
    const ids = group.keywords.map((keyword) => keyword.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    void run(async () => {
      await api.keywords.reorder(group.id, ids);
      await reloadGroups();
    });
  };

  const removeGroup = (group: KeywordGroup) =>
    void run(async () => {
      const confirmed = await confirm({
        title: `删除分组「${group.name}」？`,
        message: `该分组下的 ${group.keywords.length} 个关键词会一起删除，不可撤销。`,
        confirmLabel: "删除",
        danger: true,
      });
      if (!confirmed) return;
      await api.keywords.removeGroup(group.id);
      await reloadGroups();
    });

  const createGroup = () =>
    void run(async () => {
      const name = draftGroup.name.trim();
      const slug = draftGroup.slug.trim();
      if (!name || !slug) {
        toast.error("请填写分组名称与标识");
        return;
      }
      await api.keywords.create({
        name,
        slug,
        keywords: draftGroup.keywords
          .split(/[\n,，、]/)
          .map((part) => part.trim())
          .filter(Boolean),
      });
      setDraftGroup({ name: "", slug: "", keywords: "" });
      await reloadGroups();
      toast.success("分组已创建");
    });

  return (
    <div className="space-y-5">
      <Panel>
        <h3
          className="mb-3 text-sm font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          新建分组
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ["name", "分组名称，如「道具」", false],
              ["slug", "英文标识，如 props", true],
            ] as const
          ).map(([field, placeholder, mono]) => (
            <input
              key={field}
              value={draftGroup[field]}
              onChange={(event) =>
                setDraftGroup((prev) => ({
                  ...prev,
                  [field]: event.target.value,
                }))
              }
              placeholder={placeholder}
              className={`rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--accent)] ${mono ? "font-mono" : ""}`}
              style={{
                borderColor: "var(--border)",
                background: "var(--bg-tertiary)",
                color: "var(--text-primary)",
              }}
            />
          ))}
        </div>
        <textarea
          value={draftGroup.keywords}
          onChange={(event) =>
            setDraftGroup((prev) => ({ ...prev, keywords: event.target.value }))
          }
          rows={3}
          placeholder="初始关键词，一行一个（也可用逗号分隔）"
          className="mt-3 w-full resize-y rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
          style={{
            borderColor: "var(--border)",
            background: "var(--bg-tertiary)",
            color: "var(--text-primary)",
          }}
        />
        <button
          type="button"
          onClick={createGroup}
          disabled={busy}
          className="mt-3 rounded-lg px-5 py-2 text-xs font-semibold text-white disabled:opacity-50"
          style={{ background: "var(--accent)" }}
        >
          创建
        </button>
      </Panel>

      {groups.map((group) => (
        <Panel key={group.id}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-baseline gap-2">
              <h3
                className="text-sm font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                {group.name}
              </h3>
              <code
                className="text-[10px] font-mono"
                style={{ color: "var(--text-muted)" }}
              >
                {group.slug}
              </code>
              {group.isParameterGroup && (
                <span
                  className="rounded-full px-2 py-0.5 text-[10px]"
                  style={{
                    background: "var(--accent-light)",
                    color: "var(--accent)",
                  }}
                >
                  输出参数
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span
                className="text-xs tabular-nums"
                style={{ color: "var(--text-muted)" }}
              >
                {group.keywords.length} 个
              </span>
              <button
                type="button"
                onClick={() => removeGroup(group)}
                className="text-xs"
                style={{ color: "var(--danger)" }}
              >
                删除分组
              </button>
            </div>
          </div>

          <ul className="space-y-1.5">
            {group.keywords.map((keyword, index) => (
              <li
                key={keyword.id}
                className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--bg-tertiary)",
                }}
              >
                <span
                  className="w-6 shrink-0 text-[10px] tabular-nums"
                  style={{ color: "var(--text-muted)" }}
                >
                  {index + 1}
                </span>
                <span
                  className="min-w-0 flex-1 truncate text-xs"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {keyword.name}
                </span>
                <button
                  type="button"
                  onClick={() => move(group, index, -1)}
                  disabled={index === 0 || busy}
                  aria-label={`上移 ${keyword.name}`}
                  className="px-1 text-xs disabled:opacity-20"
                  style={{ color: "var(--text-muted)" }}
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(group, index, 1)}
                  disabled={index === group.keywords.length - 1 || busy}
                  aria-label={`下移 ${keyword.name}`}
                  className="px-1 text-xs disabled:opacity-20"
                  style={{ color: "var(--text-muted)" }}
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void run(async () => {
                      await api.keywords.remove(keyword.id);
                      await reloadGroups();
                    })
                  }
                  aria-label={`删除 ${keyword.name}`}
                  className="px-1 text-xs"
                  style={{ color: "var(--danger)" }}
                >
                  ✕
                </button>
              </li>
            ))}
            {group.keywords.length === 0 && (
              <li
                className="py-2 text-xs"
                style={{ color: "var(--text-muted)" }}
              >
                暂无关键词
              </li>
            )}
          </ul>

          <div className="mt-3 flex gap-2">
            <input
              value={drafts[group.id] ?? ""}
              onChange={(event) =>
                setDrafts((prev) => ({
                  ...prev,
                  [group.id]: event.target.value,
                }))
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addKeyword(group);
                }
              }}
              placeholder="添加关键词…"
              className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
              style={{
                borderColor: "var(--border)",
                background: "var(--bg-tertiary)",
                color: "var(--text-primary)",
              }}
            />
            <button
              type="button"
              onClick={() => addKeyword(group)}
              disabled={busy}
              className="rounded-lg px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
              style={{ background: "var(--accent)" }}
            >
              添加
            </button>
          </div>
        </Panel>
      ))}
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
  const [tab, setTab] = useState<Tab>("status");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        className="flex shrink-0 gap-1 border-b px-4 pt-3"
        style={{ borderColor: "var(--border)" }}
      >
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className="rounded-t-lg px-4 py-2.5 text-xs font-medium transition-base"
            style={{
              background:
                tab === item.key ? "var(--bg-secondary)" : "transparent",
              color:
                tab === item.key ? "var(--accent)" : "var(--text-secondary)",
              borderBottom:
                tab === item.key
                  ? "2px solid var(--accent)"
                  : "2px solid transparent",
            }}
          >
            <span aria-hidden>{item.icon}</span>
            <span className="ml-1.5">{item.label}</span>
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {tab === "status" && <StatusTab />}
        {tab === "keywords" && <KeywordsTab {...props} />}
        {tab === "history" && <HistoryTab />}
      </div>
    </div>
  );
}
