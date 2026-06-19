"use client";

import { useState } from "react";
import { KeywordGroup, ImageRecord } from "@/types";
import KeywordSelector from "./KeywordSelector";
import ImageUploader from "./ImageUploader";
import MasonryGallery from "./MasonryGallery";
import FullscreenViewer from "./FullscreenViewer";
import LoginModal from "./LoginModal";
import { useTheme } from "./ThemeProvider";

interface TaskRecord {
  id: number; status: string; type: string;
  keywordNames: string; prompt: string;
  imagePath: string; videoPath: string; posterPath: string; progress: number; error: string;
}

interface Props {
  loggedIn: boolean;
  groups: KeywordGroup[];
  selected: string[];
  onToggleKeyword: (kw: string) => void;
  onClearKeywords: () => void;
  prompt: string;
  onPromptChange: (v: string) => void;
  loading: boolean;
  statusText: string;
  mode: "keywords" | "img2img" | "video";
  onModeChange: (m: "keywords" | "img2img" | "video") => void;
  records: ImageRecord[];
  liveTasks: TaskRecord[];
  onGeneratePrompt: () => void;
  onGenerate: () => void;
  onPolish: () => void;
  onDeleteHistory: (id: number) => void;
  onDeleteTask: (id: number) => void;
  onRetryTask: (id: number) => void;
  refImages: string[];
  onRefImagesChange: (v: string[]) => void;
  videoRefImages: string[];
  onVideoRefImagesChange: (v: string[]) => void;
  videoMode: "reference" | "keyframes";
  onVideoModeChange: (v: "reference" | "keyframes") => void;
  videoWidth: number;
  onVideoWidthChange: (v: number) => void;
  videoHeight: number;
  onVideoHeightChange: (v: number) => void;
  videoFrames: number;
  onVideoFramesChange: (v: number) => void;
  videoFps: number;
  onVideoFpsChange: (v: number) => void;
  outputSize: string | null;
  videoDuration: string;
  onLoginSuccess?: () => void;
}

export default function MobileHome(props: Props) {
  const {
    loggedIn, groups, selected, onToggleKeyword, onClearKeywords,
    prompt, onPromptChange, loading, statusText,
    mode, onModeChange, records, liveTasks,
    onGeneratePrompt, onGenerate, onPolish,
    onDeleteHistory, onDeleteTask, onRetryTask,
    refImages, onRefImagesChange,
    videoRefImages, onVideoRefImagesChange,
    videoMode, onVideoModeChange,
    videoWidth, onVideoWidthChange, videoHeight, onVideoHeightChange,
    videoFrames, onVideoFramesChange, videoFps, onVideoFpsChange,
    outputSize, videoDuration, onLoginSuccess,
  } = props;

  const [tab, setTab] = useState<"generate" | "gallery" | "tasks" | "settings">("generate");
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const { theme, toggle: toggleTheme } = useTheme();

  const activeTasks = liveTasks.filter(t => t.status === "pending" || t.status === "processing");
  const failedTasks = liveTasks.filter(t => t.status === "failed");

  const tabs = [
    { key: "generate" as const, label: "创作", icon: "✨" as const, badge: 0 },
    { key: "gallery" as const, label: "图库", icon: "🖼️" as const, badge: 0 },
    { key: "tasks" as const, label: "任务", icon: "📋" as const, badge: liveTasks.length },
    { key: "settings" as const, label: "配置", icon: "⚙" as const, badge: 0 },
  ];

  const renderGenerateTab = () => (
    <div className="flex flex-col h-full">
      {/* Top: mode selector + login */}
      <div className="shrink-0 px-4 pt-3 pb-2 space-y-3 border-b border-[var(--border)]/30">
        {!loggedIn && (
          <div className="relative overflow-hidden rounded-2xl mb-1" style={{ background: "linear-gradient(135deg, rgba(217,107,43,0.12) 0%, rgba(16,22,24,0.95) 50%, rgba(136,192,168,0.06) 100%)", border: "1px solid rgba(217,107,43,0.15)" }}>
            <div className="px-4 py-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ background: "var(--accent-light)", color: "var(--accent)" }}>✦ AI 创意工坊</span>
              </div>
              <h2 className="text-lg font-bold mb-1" style={{ color: "var(--text-primary)" }}>文生图<span style={{ color: "var(--accent)" }}>工作室</span></h2>
              <p className="text-xs mb-4" style={{ color: "var(--text-secondary)" }}>关键词导演 · 参考图编辑 · 视频生成</p>
              <button
                onClick={() => setShowLogin(true)}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all active:scale-[0.98]"
                style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-hover))", boxShadow: "0 4px 16px var(--accent-glow)" }}
              >
                <span>🔐</span><span>登录开始创作</span><span className="text-xs opacity-80">→</span>
              </button>
            </div>
          </div>
        )}
        <div className="grid grid-cols-3 gap-1.5 bg-[var(--bg-tertiary)] rounded-xl p-1">
          {(["keywords", "img2img", "video"] as const).map((m) => (
            <button
              key={m}
              onClick={() => onModeChange(m)}
              className="py-2 rounded-lg text-xs font-medium transition"
              style={{
                background: mode === m ? "var(--accent)" : "transparent",
                color: mode === m ? "#fff" : "var(--text-secondary)",
              }}
            >
              {{keywords: "🎨 关键词", img2img: "🖼️ 参考图", video: "🎬 视频"}[m]}
            </button>
          ))}
        </div>
      </div>

      {/* Middle: scrollable keyword/video area */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 overscroll-contain">
        {(mode === "keywords" || mode === "img2img") && (
          <>
            {mode === "img2img" && (
              <div>
                <p className="text-xs text-[var(--text-muted)] mb-2">参考图</p>
                <ImageUploader images={refImages} onChange={onRefImagesChange} />
              </div>
            )}
            <KeywordSelector groups={groups} selected={selected} onToggle={onToggleKeyword} onClear={onClearKeywords} />
          </>
        )}

        {mode === "video" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onVideoModeChange("reference")}
                className="py-2 rounded-lg text-xs font-medium transition"
                style={{ background: videoMode === "reference" ? "var(--accent)" : "var(--bg-tertiary)", color: videoMode === "reference" ? "#fff" : "var(--text-secondary)" }}
              >参考图</button>
              <button
                onClick={() => onVideoModeChange("keyframes")}
                className="py-2 rounded-lg text-xs font-medium transition"
                style={{ background: videoMode === "keyframes" ? "var(--accent)" : "var(--bg-tertiary)", color: videoMode === "keyframes" ? "#fff" : "var(--text-secondary)" }}
              >关键帧</button>
            </div>
            <ImageUploader images={videoRefImages} onChange={onVideoRefImagesChange} allowUpload={false} allowDataUri={false} hint="仅支持公网 URL" />
            <div className="grid grid-cols-2 gap-2 text-xs">
              <select value={videoWidth} onChange={e => onVideoWidthChange(Number(e.target.value))} className="bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg px-2 py-2 text-[var(--text-primary)]">
                <option value={768}>宽 768</option><option value={1080}>宽 1080</option><option value={1920}>宽 1920</option>
              </select>
              <select value={videoHeight} onChange={e => onVideoHeightChange(Number(e.target.value))} className="bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg px-2 py-2 text-[var(--text-primary)]">
                <option value={576}>高 576</option><option value={768}>高 768</option><option value={1080}>高 1080</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Bottom: textarea + action buttons — always visible */}
      <div className="shrink-0 px-4 pt-2 pb-3 border-t border-[var(--border)] bg-[var(--bg-secondary)] space-y-1.5" style={{ boxShadow: "0 -1px 8px rgba(0,0,0,0.3)" }}>
        <textarea
          value={prompt}
          onChange={e => onPromptChange(e.target.value)}
          rows={1}
          className="w-full rounded-md border border-[var(--border)] bg-[var(--bg-tertiary)] px-3 py-1.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] resize-none focus:outline-none focus:border-[var(--accent)]"
          placeholder={mode === "video" ? "描述动作、镜头..." : mode === "img2img" ? "要保留和修改的内容..." : "先选词，或直接写提示词..."}
        />
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-[var(--text-muted)] tabular-nums shrink-0">{prompt.length}c</span>
          {mode === "keywords" && (
            <button
              onClick={onGeneratePrompt}
              disabled={loading || selected.length === 0 || !loggedIn}
              className="px-2.5 py-1.5 rounded-md text-xs font-medium transition disabled:opacity-40 shrink-0"
              style={{ background: "var(--bg-tertiary)", color: "var(--text-secondary)" }}
            >
              {loading && statusText === "正在生成提示词..." ? "…" : "生词"}
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={onPolish}
            disabled={loading || !prompt.trim()}
            className="px-3 py-1.5 rounded-md text-xs font-medium transition disabled:opacity-40"
            style={{ background: "var(--bg-tertiary)", color: "var(--text-secondary)" }}
          >
            润色
          </button>
          <button
            onClick={onGenerate}
            disabled={loading || !loggedIn || (!prompt.trim() && mode !== "img2img")}
            className="px-4 py-1.5 rounded-md text-xs font-semibold text-white transition disabled:opacity-40"
            style={{ background: loading || !loggedIn ? "var(--bg-tertiary)" : "var(--accent)" }}
          >
            {!loggedIn ? "登录" : loading && statusText !== "AI 润色中..." ? statusText : mode === "video" ? "生成视频" : "生成图片"}
          </button>
        </div>
      </div>

      {showLogin && (
        <LoginModal
          onClose={() => setShowLogin(false)}
          onSuccess={() => {
            setShowLogin(false);
            onLoginSuccess?.();
          }}
        />
      )}
    </div>
  );

  const renderGalleryTab = () => (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-3 py-3">
        <MasonryGallery
          records={records}
          liveTasks={liveTasks} loading={loading}
          onDelete={onDeleteHistory}
          onDeleteTask={onDeleteTask}
          onImageClick={(record) => {
            const idx = records.findIndex(r => r.id === record.id);
            setViewerIndex(idx >= 0 ? idx : 0);
          }}
        />
      </div>
      {viewerIndex !== null && (
        <FullscreenViewer
          records={records}
          activeIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
          onDelete={onDeleteHistory}
        />
      )}
    </div>
  );

  const renderTasksTab = () => (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {liveTasks.length === 0 && (
          <p className="text-center text-sm text-[var(--text-muted)] py-12">暂无任务</p>
        )}
        {activeTasks.map(task => (
          <div key={task.id} className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-[var(--text-muted)]">#{task.id} · {task.type === "video" ? "视频" : "图片"}</span>
              <button onClick={() => onDeleteTask(task.id)} className="text-[10px] text-red-400">删除</button>
            </div>
            <p className="text-xs text-[var(--text-secondary)] line-clamp-2 mb-3">{task.prompt || task.keywordNames}</p>
            <div className="h-2 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${task.progress}%`, background: "var(--accent)" }}
              />
            </div>
            <p className="text-[10px] text-[var(--text-muted)] mt-1.5">
              {task.status === "processing" ? `生成中 ${task.progress}%` : "排队中"}
            </p>
          </div>
        ))}
        {failedTasks.map(task => (
          <div key={task.id} className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-red-400">#{task.id} · 失败</span>
              <div className="flex gap-2">
                <button onClick={() => onRetryTask(task.id)} className="text-[10px] text-[var(--accent)]">重试</button>
                <button onClick={() => onDeleteTask(task.id)} className="text-[10px] text-red-400">删除</button>
              </div>
            </div>
            <p className="text-xs text-[var(--text-secondary)] line-clamp-2 mb-1">{task.prompt || task.keywordNames}</p>
            {task.error && <p className="text-[10px] text-red-400/70 mt-1">{task.error}</p>}
          </div>
        ))}
      </div>
    </div>
  );

  const renderSettingsTab = () => (
    <div className="flex flex-col h-full overflow-y-auto px-4 py-4 space-y-4">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-4">
        <p className="text-xs text-[var(--text-muted)] mb-1">服务器</p>
        <p className="text-sm text-[var(--text-primary)] font-mono">{typeof window !== "undefined" ? window.location.origin : ""}</p>
      </div>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-4">
        <p className="text-xs text-[var(--text-muted)] mb-1">状态</p>
        <p className="text-sm" style={{ color: loggedIn ? "var(--success)" : "var(--danger)" }}>
          {loggedIn ? "已登录" : "未登录"}
        </p>
      </div>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-4">
        <p className="text-xs text-[var(--text-muted)] mb-1">主题</p>
        <button onClick={toggleTheme} className="w-full text-left text-sm text-[var(--text-primary)]">
          {theme === "dark" ? "☀️ 切换明亮模式" : "🌙 切换暗黑模式"}
        </button>
      </div>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-4">
        <p className="text-xs text-[var(--text-muted)] mb-1">生成模式</p>
        <p className="text-sm text-[var(--text-primary)]">
          {{keywords: "关键词生图", manual: "手动生图", img2img: "参考图生图", video: "视频生成"}[mode]}
        </p>
      </div>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-4">
        <p className="text-xs text-[var(--text-muted)] mb-1">输出规格</p>
        <p className="text-sm text-[var(--text-primary)]">{outputSize || "待选择"}</p>
      </div>
      <a
        href="/admin"
        className="block text-center py-3 rounded-xl text-sm font-medium transition"
        style={{ background: "var(--bg-tertiary)", color: "var(--text-secondary)" }}
      >
        后台管理
      </a>
      <p className="text-center text-[10px] text-[var(--text-muted)] pt-2">AI 文生图 v1.0</p>
    </div>
  );

  return (
    <div className="fixed inset-0 flex flex-col bg-[var(--bg-primary)] text-[var(--text-primary)]" style={{ overscrollBehavior: "contain" }}>
      {/* Header — fixed */}
      <div
        className="shrink-0 px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-secondary)]/95 backdrop-blur-xl flex items-center justify-between"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}
      >
        <h1 className="text-base font-bold">AI 文生图</h1>
        <div className="flex gap-2 text-[10px] text-[var(--text-muted)]">
          <span>{records.length} 作品</span>
          <span>·</span>
          <span>{activeTasks.length} 进行中</span>
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {tab === "generate" && renderGenerateTab()}
        {tab === "gallery" && renderGalleryTab()}
        {tab === "tasks" && renderTasksTab()}
        {tab === "settings" && renderSettingsTab()}
      </div>

      {/* Bottom tabs — fixed to viewport */}
      <div className="shrink-0 flex border-t border-[var(--border)] bg-[var(--bg-secondary)]" style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))', boxShadow: '0 -1px 8px rgba(0,0,0,0.25)' }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as typeof tab)}
            className="flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 transition"
            style={{ color: tab === t.key ? "var(--accent)" : "var(--text-muted)" }}
          >
            <span className="text-lg leading-none">{t.icon}</span>
            <span className="text-[10px] font-medium relative">
              {t.label}
              {t.badge !== undefined && t.badge > 0 && (
                <span className="absolute -top-1 -right-3 w-3.5 h-3.5 rounded-full bg-[var(--danger)] text-white text-[8px] flex items-center justify-center">
                  {t.badge}
                </span>
              )}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
