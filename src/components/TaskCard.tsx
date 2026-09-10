"use client";

import type { TaskRecord } from "@/types";

interface Props {
  task: TaskRecord;
  onDelete: (id: number) => void;
  onRetry: (id: number) => void;
}

function statusLabel(task: TaskRecord): string {
  if (task.status === "failed") return "生成失败";
  if (task.status === "pending") return "排队中…";
  return "生成中…";
}

export default function TaskCard({ task, onDelete, onRetry }: Props) {
  const failed = task.status === "failed";
  const pending = task.status === "pending";

  return (
    <article
      className="flex flex-col overflow-hidden rounded-xl border"
      style={{
        borderColor: failed ? "var(--danger)" : "var(--border)",
        background: "var(--bg-secondary)",
        aspectRatio: "3 / 4",
      }}
    >
      <div
        className="flex flex-1 flex-col items-center justify-center gap-3 p-4"
        style={{ background: "var(--bg-tertiary)" }}
      >
        {failed ? (
          <>
            <span className="text-2xl" aria-hidden>
              ⚠️
            </span>
            <p
              className="text-xs font-medium"
              style={{ color: "var(--danger)" }}
            >
              生成失败
            </p>
            {task.error && (
              <p
                className="line-clamp-4 px-1 text-center text-[11px] leading-4"
                style={{ color: "var(--text-muted)" }}
                title={task.error}
              >
                {task.error}
              </p>
            )}
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => onRetry(task.id)}
                className="rounded-md border px-3 py-1 text-[11px] font-medium transition-base hover:border-[var(--accent)]"
                style={{ borderColor: "var(--border)", color: "var(--accent)" }}
              >
                重试
              </button>
              <button
                type="button"
                onClick={() => onDelete(task.id)}
                className="rounded-md border px-3 py-1 text-[11px] transition-base hover:border-[var(--danger)] hover:text-[var(--danger)]"
                style={{
                  borderColor: "var(--border)",
                  color: "var(--text-muted)",
                }}
              >
                删除
              </button>
            </div>
          </>
        ) : (
          <>
            <div
              className="h-10 w-10 animate-spin rounded-full border-2"
              style={{
                borderColor: "var(--border)",
                borderTopColor: "var(--accent)",
              }}
              aria-hidden
            />
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {statusLabel(task)}
            </p>
            <div className="w-full">
              <div
                className="h-1.5 w-full overflow-hidden rounded-full"
                style={{ background: "var(--border)" }}
              >
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.max(pending ? 4 : 8, Math.min(task.progress || 0, 100))}%`,
                    background: "var(--accent)",
                  }}
                />
              </div>
              <p
                className="mt-1 text-center text-[10px] tabular-nums"
                style={{ color: "var(--text-muted)" }}
              >
                {task.progress ? `${task.progress}%` : "约需 15-60 秒"}
              </p>
            </div>
          </>
        )}
      </div>

      <div className="border-t p-3" style={{ borderColor: "var(--border)" }}>
        <p
          className="text-[10px] font-medium"
          style={{ color: "var(--text-muted)" }}
        >
          {task.type === "img2img" ? "参考图编辑" : "关键词生图"}
          <span className="ml-2 tabular-nums opacity-60">#{task.id}</span>
        </p>
        <p
          className="mt-0.5 line-clamp-2 text-[11px] leading-tight"
          style={{ color: "var(--text-secondary)" }}
        >
          {task.prompt || task.keywordNames || "…"}
        </p>
      </div>
    </article>
  );
}
