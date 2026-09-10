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
        <span className="text-5xl" aria-hidden>
          🎨
        </span>
        <p
          className="mt-4 text-base font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          准备开始创作
        </p>
        <p
          className="mx-auto mt-2 max-w-md text-sm leading-relaxed"
          style={{ color: "var(--text-secondary)" }}
        >
          选好关键词后点「生成提示词」让 AI
          写画面描述，也可以直接手写，然后提交生成。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {loading && records.length === 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((key) => (
            <div
              key={key}
              className="animate-skeleton rounded-xl"
              style={{
                border: "1px solid var(--border)",
                aspectRatio: "3 / 4",
              }}
            />
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
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
            className="rounded-lg border px-5 py-2.5 text-sm font-medium transition-base hover:border-[var(--border-hover)] disabled:opacity-50"
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
