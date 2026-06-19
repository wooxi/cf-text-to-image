"use client";

interface TaskRecord {
  id: number; status: string; type: string;
  keywordNames: string; prompt: string;
  imagePath: string; videoPath: string; posterPath: string; progress: number; error: string;
}

interface Props {
  task: TaskRecord;
  onDelete: (id: number) => void;
}

export default function TaskCard({ task, onDelete }: Props) {
  const isFailed = task.status === "failed";
  const isProcessing = task.status === "pending" || task.status === "processing";
  const isVideo = task.type === "video";

  return (
    <div className="break-inside-avoid mb-3 sm:mb-4 rounded-xl overflow-hidden border group relative"
      style={{ background: "var(--bg-secondary)", borderColor: isFailed ? "var(--danger)" : "var(--border)" }}>
      {isFailed && (
        <button onClick={() => onDelete(task.id)}
          className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/50 text-white/70 hover:bg-red-600 hover:text-white flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity z-10">✕</button>
      )}
      <div className="flex flex-col items-center justify-center p-6" style={{ background: "var(--bg-tertiary)", minHeight: "12rem" }}>
        {isProcessing && (
          <>
            <div className="w-10 h-10 border-2 rounded-full animate-spin mb-3"
              style={{ borderColor: "var(--border)", borderTopColor: "var(--accent)" }} />
            <p className="text-xs text-app-text3 text-center">
              {isVideo ? "视频生成中..." : task.status === "pending" ? "排队中..." : "生成中..."}
            </p>
            {isVideo && task.progress > 0 && (
              <div className="w-full mt-3">
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                  <div className="h-full rounded-full" style={{ width: `${Math.min(task.progress, 100)}%`, background: "var(--accent)" }} />
                </div>
                <p className="text-xs text-app-text3 mt-1 text-center opacity-70">{task.progress}%</p>
              </div>
            )}
            <p className="text-xs text-app-text3 mt-1 opacity-60">{isVideo ? "约需 3-10 分钟" : "约需 15-60 秒"}</p>
          </>
        )}
        {isFailed && (
          <>
            <div className="text-2xl mb-2">⚠️</div>
            <p className="text-xs text-center" style={{ color: "var(--danger)" }}>生成失败</p>
            {task.error && <p className="text-xs text-app-text3 mt-1 text-center line-clamp-3 px-2">{task.error}</p>}
          </>
        )}
      </div>
      <div className="p-3">
        <p className="text-xs text-app-text3 line-clamp-1">
          {isVideo ? "视频" : task.type === "img2img" ? "图生图" : "文生图"}
        </p>
        <p className="text-xs text-app-text3 line-clamp-2 mt-0.5">{task.keywordNames}</p>
      </div>
    </div>
  );
}
