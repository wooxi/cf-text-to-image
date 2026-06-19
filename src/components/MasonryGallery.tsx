"use client";

import { useState, useMemo } from "react";
import { ImageRecord } from "@/types";
import ImageCard from "./ImageCard";
import TaskCard from "./TaskCard";

interface TaskRecord {
  id: number; status: string; type: string;
  keywordNames: string; prompt: string;
  imagePath: string; videoPath: string; posterPath: string; progress: number; error: string;
}

type SortOrder = "newest" | "oldest";
type FilterType = "all" | "image" | "video";

interface Props {
  records: ImageRecord[];
  liveTasks: TaskRecord[];
  onDelete: (id: number) => void;
  onDeleteTask: (id: number) => void;
  onImageClick?: (record: ImageRecord) => void;
  loading?: boolean;
}

function isVideo(record: ImageRecord) { return record.type === "video" || /\.(mp4|webm|mov)$/i.test(record.imagePath); }

const FILTER_OPTIONS: { key: FilterType; label: string; icon: string }[] = [
  { key: "all", label: "全部", icon: "📋" },
  { key: "image", label: "图片", icon: "🖼️" },
  { key: "video", label: "视频", icon: "🎬" },
];

export default function MasonryGallery({ records, liveTasks, onDelete, onDeleteTask, onImageClick, loading }: Props) {
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [filterType, setFilterType] = useState<FilterType>("all");

  const counts = useMemo(() => ({
    all: records.length,
    image: records.filter((r) => !isVideo(r)).length,
    video: records.filter((r) => isVideo(r)).length,
  }), [records]);

  const sorted = useMemo(() => {
    const filtered = records.filter((r) => {
      if (filterType === "image") return !isVideo(r);
      if (filterType === "video") return isVideo(r);
      return true;
    });
    return [...filtered].sort((a, b) => {
      const ta = new Date(a.createdAt).getTime();
      const tb = new Date(b.createdAt).getTime();
      return sortOrder === "newest" ? tb - ta : ta - tb;
    });
  }, [records, filterType, sortOrder]);

  if (!loading && records.length === 0 && liveTasks.length === 0) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-dashed animate-fade-in" style={{ borderColor: "var(--border)", background: "linear-gradient(135deg, rgba(217,107,43,0.03) 0%, transparent 50%, rgba(136,192,168,0.03) 100%)" }}>
        <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
          <div className="relative mb-5">
            <div className="absolute inset-0 rounded-full blur-2xl opacity-20" style={{ background: "var(--accent)", width: "80px", height: "80px", left: "-10px", top: "-10px" }} />
            <span className="relative text-6xl">🎨</span>
          </div>
          <p className="text-lg font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
            准备开始创作
          </p>
          <p className="text-sm leading-relaxed max-w-md" style={{ color: "var(--text-secondary)" }}>
            在左侧选择关键词，点击「生成提示词」让 AI 为你撰写画面描述，或直接手写后点击「提交生成」。
          </p>
          <div className="mt-5 flex gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
            <span className="rounded-full px-3 py-1 border" style={{ borderColor: "var(--border)", background: "var(--bg-tertiary)" }}>🎨 关键词</span>
            <span className="rounded-full px-3 py-1 border" style={{ borderColor: "var(--border)", background: "var(--bg-tertiary)" }}>🖼️ 参考图</span>
            <span className="rounded-full px-3 py-1 border" style={{ borderColor: "var(--border)", background: "var(--bg-tertiary)" }}>🎬 视频</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 animate-slide-down">
        <div className="flex gap-1 rounded-full border p-1" style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
          {FILTER_OPTIONS.map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => setFilterType(key)}
              className="rounded-full px-3.5 py-1.5 text-xs font-medium transition-all duration-200 flex items-center gap-1"
              style={{
                background: filterType === key ? "var(--accent)" : "transparent",
                color: filterType === key ? "#fff" : "var(--text-secondary)",
                boxShadow: filterType === key ? "0 2px 8px var(--accent-glow)" : "none",
              }}
            >
              <span className="text-[10px]">{icon}</span>
              <span>{label}</span>
              <span className="tabular-nums opacity-70" style={{ color: filterType === key ? "rgba(255,255,255,0.7)" : "var(--text-muted)" }}>
                {counts[key]}
              </span>
            </button>
          ))}
        </div>
        <button
          onClick={() => setSortOrder((o) => (o === "newest" ? "oldest" : "newest"))}
          className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
          style={{ borderColor: "var(--border)", background: "var(--bg-secondary)", color: "var(--text-secondary)" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--border-hover)";
            e.currentTarget.style.color = "var(--text-primary)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--border)";
            e.currentTarget.style.color = "var(--text-secondary)";
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ transform: sortOrder === "oldest" ? "rotate(180deg)" : "none", transition: "transform 0.3s ease" }}>
            <path d="M12 5v14M5 12l7-7 7 7" />
          </svg>
          {sortOrder === "newest" ? "最新优先" : "最早优先"}
        </button>
      </div>

      {loading && records.length === 0 && (
        <div className="columns-1 xs:columns-2 sm:columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-4 sm:gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="break-inside-avoid mb-4 rounded-xl overflow-hidden animate-skeleton" style={{ border: "1px solid var(--border)", aspectRatio: String(0.7 + Math.random() * 0.6), minHeight: "180px" }} />
          ))}
        </div>
      )}

      <div className="columns-1 xs:columns-2 sm:columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-4 sm:gap-5 stagger-children">
        {liveTasks.map((task) => (
          <TaskCard key={`task-${task.id}`} task={task} onDelete={onDeleteTask} />
        ))}
        {sorted.map((record) => (
          <ImageCard key={record.id} record={record} onDelete={onDelete} onImageClick={onImageClick} />
        ))}
      </div>

      {sorted.length === 0 && liveTasks.length === 0 && records.length > 0 && (
        <div className="empty-state gap-3 mt-4 animate-fade-in">
          <span className="text-2xl opacity-40">🔍</span>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            当前筛选条件下没有作品
          </p>
        </div>
      )}
    </div>
  );
}
