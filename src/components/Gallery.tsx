"use client";

import type { ImageRecord, TaskRecord } from "@/types";
import ImageCard from "./ImageCard";
import TaskCard from "./TaskCard";

interface Props {
  records: ImageRecord[];
  liveTasks: TaskRecord[];
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onDelete: (record: ImageRecord) => void;
  onDeleteTask: (id: number) => void;
  onRetryTask: (id: number) => void;
  onOpen: (record: ImageRecord) => void;
}

const GRID =
  "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6";

export default function Gallery({
  records,
  liveTasks,
  loading,
  hasMore,
  onLoadMore,
  onDelete,
  onDeleteTask,
  onRetryTask,
  onOpen,
}: Props) {
  if (!loading && records.length === 0 && liveTasks.length === 0) {
    return (
      <div
        className="rounded-2xl border border-dashed px-6 py-16 text-center"
        style={{ borderColor: "var(--border)" }}
      >
        <span className="text-4xl" aria-hidden>
          🎨
        </span>
        <p
          className="mt-4 text-sm font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          还没有作品
        </p>
        <p
          className="mx-auto mt-2 max-w-md text-xs leading-relaxed"
          style={{ color: "var(--text-secondary)" }}
        >
          到「创作台」选几个关键词，让 AI 写画面描述，或者直接手写一段，提交后就会出现在这里。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {loading && records.length === 0 && (
        <div className={GRID}>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((key) => (
            <div
              key={key}
              className="animate-skeleton aspect-square rounded-xl"
              style={{ border: "1px solid var(--border)" }}
            />
          ))}
        </div>
      )}

      <div className={GRID}>
        {liveTasks.map((task) => (
          <TaskCard
            key={`task-${task.id}`}
            task={task}
            onDelete={onDeleteTask}
            onRetry={onRetryTask}
          />
        ))}
        {records.map((record) => (
          <ImageCard
            key={record.id}
            record={record}
            onDelete={onDelete}
            onOpen={onOpen}
          />
        ))}
      </div>

      {hasMore && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={loading}
            className="rounded-lg border px-5 py-2 text-xs font-medium transition-base hover:border-[var(--border-hover)] disabled:opacity-50"
            style={{
              borderColor: "var(--border)",
              color: "var(--text-secondary)",
              background: "var(--bg-tertiary)",
            }}
          >
            {loading ? "加载中…" : "加载更多"}
          </button>
        </div>
      )}
    </div>
  );
}
