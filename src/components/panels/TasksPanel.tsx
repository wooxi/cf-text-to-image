"use client";

import type { TaskRecord } from "@/types";

interface Props {
  tasks: TaskRecord[];
  onRetry: (id: number) => void;
  onDelete: (id: number) => void;
}

function label(task: TaskRecord): string {
  if (task.status === "failed") return "失败";
  if (task.status === "pending") return "排队中";
  return "生成中";
}

export default function TasksPanel({ tasks, onRetry, onDelete }: Props) {
  if (tasks.length === 0) {
    return (
      <div className="py-16 text-center">
        <span className="text-3xl opacity-40" aria-hidden>
          📭
        </span>
        <p className="mt-3 text-sm" style={{ color: "var(--text-muted)" }}>
          暂无进行中的任务
        </p>
      </div>
    );
  }

  const active = tasks.filter(
    (t) => t.status === "pending" || t.status === "processing",
  );
  const failed = tasks.filter((t) => t.status === "failed");

  const Section = ({
    title,
    items,
    showRetry,
  }: {
    title: string;
    items: TaskRecord[];
    showRetry: boolean;
  }) =>
    items.length === 0 ? null : (
      <section className="space-y-2">
        <h3
          className="text-[13px] font-semibold"
          style={{ color: "var(--text-muted)" }}
        >
          {title}（{items.length}）
        </h3>
        {items.map((task) => {
          const isFailed = task.status === "failed";
          return (
            <article
              key={task.id}
              className="rounded-xl border p-3"
              style={{
                borderColor: isFailed ? "var(--danger)" : "var(--border)",
                background: "var(--bg-secondary)",
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <div
                  className="flex items-center gap-2 text-[11px]"
                  style={{ color: "var(--text-muted)" }}
                >
                  <span className="tabular-nums">#{task.id}</span>
                  <span>
                    {task.type === "img2img" ? "参考图编辑" : "关键词生图"}
                  </span>
                  {task.size && (
                    <span className="tabular-nums">{task.size}</span>
                  )}
                </div>
                <span
                  className="shrink-0 text-[11px] font-medium"
                  style={{
                    color: isFailed ? "var(--danger)" : "var(--accent)",
                  }}
                >
                  {label(task)}
                </span>
              </div>

              <p
                className="mt-1.5 line-clamp-2 text-xs leading-relaxed"
                style={{ color: "var(--text-secondary)" }}
              >
                {task.prompt || task.keywordNames || "…"}
              </p>

              {!isFailed && (
                <div
                  className="mt-2 h-1.5 overflow-hidden rounded-full"
                  style={{ background: "var(--bg-tertiary)" }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${Math.max(4, Math.min(task.progress || 0, 100))}%`,
                      background: "var(--accent)",
                    }}
                  />
                </div>
              )}

              {task.error && (
                <p
                  className="mt-2 line-clamp-2 text-[11px] leading-4"
                  style={{ color: "var(--danger)" }}
                >
                  {task.error}
                </p>
              )}

              <div className="mt-2 flex gap-3 text-[11px]">
                {showRetry && (
                  <button
                    type="button"
                    onClick={() => onRetry(task.id)}
                    style={{ color: "var(--accent)" }}
                  >
                    重试
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onDelete(task.id)}
                  style={{ color: "var(--text-muted)" }}
                >
                  删除
                </button>
              </div>
            </article>
          );
        })}
      </section>
    );

  return (
    <div className="space-y-5">
      <Section title="进行中" items={active} showRetry={false} />
      <Section title="失败" items={failed} showRetry />
    </div>
  );
}
