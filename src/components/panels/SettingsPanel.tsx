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

const TABS: { key: Tab; label: string }[] = [
  { key: "status", label: "运行状态" },
  { key: "keywords", label: "关键词" },
  { key: "history", label: "生成历史" },
];

/** 可选变量在「已配置」之外的第二种状态需要一句人话解释 */
const OPTIONAL_NOTES: Record<string, string> = {
  IMAGE_BED_ENDPOINT: "成品图改传图床，库里存外链",
  IMAGE_BED_AUTH_CODE: "与图床的上传认证码一致",
  IMAGE_BED_CHANNEL: "cfr2 走 R2 无损；telegram 等渠道会压缩",
};

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

/** 卡片外壳：标题栏 + 内容区，替代原来「一个变量一张大卡」的写法。 */
function Card({
  title,
  extra,
  children,
}: {
  title: string;
  extra?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      className="overflow-hidden rounded-xl border"
      style={{
        borderColor: "var(--border)",
        background: "var(--bg-secondary)",
      }}
    >
      <div
        className="flex items-center justify-between gap-3 border-b px-4 py-2.5"
        style={{ borderColor: "var(--border)" }}
      >
        <h3
          className="text-[13px] font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          {title}
        </h3>
        {extra}
      </div>
      <div>{children}</div>
    </section>
  );
}

/** 变量行：等宽变量名 + 说明 + 右侧状态点。一行 40px，不再是整张卡。 */
function EnvRow({
  name,
  note,
  ok,
  optional,
}: {
  name: string;
  note: string;
  ok: boolean;
  optional?: boolean;
}) {
  const color = ok
    ? "var(--success)"
    : optional
      ? "var(--text-muted)"
      : "var(--danger)";
  return (
    <div
      className="flex items-center justify-between gap-3 px-4 py-2 [&+&]:border-t"
      style={{ borderColor: "var(--border)" }}
    >
      <div className="flex min-w-0 items-baseline gap-2.5">
        <code
          className="shrink-0 text-xs font-mono"
          style={{ color: "var(--text-primary)" }}
        >
          {name}
        </code>
        <span
          className="truncate text-[10px]"
          style={{ color: "var(--text-muted)" }}
          title={note}
        >
          {note}
        </span>
      </div>
      <span
        className="flex shrink-0 items-center gap-1.5 text-[11px]"
        style={{ color }}
      >
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: color }}
        />
        {ok ? "已配置" : optional ? "未配置" : "缺失"}
      </span>
    </div>
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

  if (!status) {
    return (
      <div className="space-y-3">
        {[0, 1].map((key) => (
          <div
            key={key}
            className="animate-skeleton h-32 rounded-xl"
            style={{ border: "1px solid var(--border)" }}
          />
        ))}
      </div>
    );
  }

  const missing = new Set(status.missing);
  const healthy = status.missing.length === 0;
  const optionalSet = status.optionalSet ?? {};

  const summary: [string, string][] = [
    ["LLM 模型", status.resolved.llmModel || "—"],
    ["图像模型", status.resolved.imageModel || "—"],
    [
      "成品图存放",
      status.storage === "image-bed"
        ? `图床 ${status.resolved.imageBedEndpoint}`.trim()
        : "本站 R2",
    ],
    [
      "系统提示词",
      status.overrides.image ? "已自定义" : "内置默认",
    ],
  ];

  const prompts: [string, string, boolean][] = [
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
  ];

  return (
    <div className="space-y-4">
      {/* 总览：一眼看到服务是否健康 + 关键参数 */}
      <section
        className="rounded-xl border p-4"
        style={{
          borderColor: healthy ? "var(--border)" : "var(--danger)",
          background: "var(--bg-secondary)",
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold"
              style={{
                background: healthy ? "var(--success-bg)" : "var(--danger-bg)",
                color: healthy ? "var(--success)" : "var(--danger)",
              }}
              aria-hidden
            >
              {healthy ? "✓" : "!"}
            </span>
            <div className="min-w-0">
              <p
                className="text-sm font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                {healthy ? "服务配置完整" : `缺少 ${status.missing.length} 项配置`}
              </p>
              <p
                className="mt-0.5 text-[11px] leading-relaxed"
                style={{ color: "var(--text-muted)" }}
              >
                {healthy
                  ? `${status.required.length} 个必需变量已全部就绪，可以正常出图`
                  : `缺少 ${status.missing.join("、")}，服务无法正常工作`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void ping()}
            disabled={pinging || !healthy}
            className="shrink-0 rounded-lg border px-3.5 py-1.5 text-xs font-medium transition-base hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-40"
            style={{
              borderColor: "var(--border)",
              color: "var(--text-secondary)",
            }}
          >
            {pinging ? "检测中…" : "测试连通性"}
          </button>
        </div>

        <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          {summary.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt
                className="text-[10px] uppercase tracking-wider"
                style={{ color: "var(--text-muted)" }}
              >
                {label}
              </dt>
              <dd
                className="mt-0.5 truncate font-mono text-xs"
                style={{ color: "var(--text-secondary)" }}
                title={value}
              >
                {value || "—"}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <Card
        title="环境变量"
        extra={
          <span
            className="text-[11px] tabular-nums"
            style={{ color: "var(--text-muted)" }}
          >
            {status.required.length - status.missing.length}/
            {status.required.length} 已配置
          </span>
        }
      >
        {status.required.map(({ key, scope }) => (
          <EnvRow
            key={key}
            name={key}
            note={`${scope}${scope === "Worker" ? " 环境变量" : ""}`}
            ok={!missing.has(key)}
          />
        ))}
      </Card>

      <Card
        title="可选变量"
        extra={
          <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            不配也能跑，成品图回退存 R2
          </span>
        }
      >
        {status.optional.map(({ key }) => (
          <EnvRow
            key={key}
            name={key}
            note={OPTIONAL_NOTES[key] ?? ""}
            ok={Boolean(optionalSet[key])}
            optional
          />
        ))}
      </Card>

      <Card title="系统提示词">
        {prompts.map(([key, value, overridden]) => (
          <details
            key={key}
            className="group [&+&]:border-t"
            style={{ borderColor: "var(--border)" }}
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-2.5 transition-base hover:bg-[var(--bg-tertiary)]">
              <div className="flex min-w-0 items-center gap-2.5">
                <span
                  className="text-[10px] transition-transform group-open:rotate-90"
                  style={{ color: "var(--text-muted)" }}
                  aria-hidden
                >
                  ▶
                </span>
                <code
                  className="shrink-0 text-xs font-mono"
                  style={{ color: "var(--text-primary)" }}
                >
                  {key}
                </code>
                <span
                  className="rounded-full px-2 py-0.5 text-[10px]"
                  style={{
                    background: overridden
                      ? "var(--accent-light)"
                      : "var(--bg-tertiary)",
                    color: overridden ? "var(--accent)" : "var(--text-muted)",
                  }}
                >
                  {overridden ? "已自定义" : "内置默认"}
                </span>
              </div>
              <span
                className="shrink-0 text-[11px] tabular-nums"
                style={{ color: "var(--text-muted)" }}
              >
                {value.length} 字
              </span>
            </summary>
            <div
              className="max-h-64 overflow-y-auto whitespace-pre-wrap break-words px-4 pb-4 text-[11px] leading-relaxed"
              style={{ color: "var(--text-secondary)" }}
            >
              {value}
            </div>
          </details>
        ))}
      </Card>

      <p className="px-1 text-[11px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
        变量都在 Cloudflare 控制台改：Workers &amp; Pages → cf-text-to-image → Settings →
        Variables and Secrets。改完重新部署一次生效；密钥值永远不会回传到这里。
      </p>
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
        className="shrink-0 border-b backdrop-blur-xl"
        style={{
          borderColor: "var(--border)",
          background: "var(--bg-elevated, var(--bg-secondary))",
        }}
      >
        <div className="mx-auto flex w-full max-w-4xl gap-6 px-4 lg:px-6">
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
        <div className="mx-auto w-full max-w-4xl">
        {tab === "status" && <StatusTab />}
        {tab === "keywords" && <KeywordsTab {...props} />}
        {tab === "history" && <HistoryTab />}
        </div>
      </div>
    </div>
  );
}
