"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import KeywordSelector from "@/components/KeywordSelector";
import ImageUploader from "@/components/ImageUploader";
import MasonryGallery from "@/components/MasonryGallery";
import MobileHome from "@/components/MobileHome";
import LoginModal from "@/components/LoginModal"
import FullscreenViewer from "@/components/FullscreenViewer";
import { KeywordFacet, KeywordGroup, ImageRecord } from "@/types";

const SIZE_MAP: [string, string][] = [
  ["9:16", "768x1344"], ["16:9", "1344x768"], ["4:3", "1024x768"],
  ["3:4", "768x1024"], ["1:1", "1024x1024"],
];

const SIZE_TIERS: Record<string, Record<string, string>> = {
  "1:1": { "2048": "2048x2048", "1536": "1536x1536", "1024": "1024x1024", "512": "512x512" },
  "9:16": { "2048": "1440x2560", "1536": "1152x2048", "1024": "768x1344", "512": "768x1344" },
  "16:9": { "2048": "2048x1152", "1536": "1344x768", "1024": "1344x768", "512": "1344x768" },
  "4:3": { "2048": "2048x1536", "1536": "1536x1152", "1024": "1024x768", "512": "1024x768" },
  "3:4": { "2048": "1536x2048", "1536": "1152x1536", "1024": "768x1024", "512": "768x1024" },
};

const MODE_META = {
  keywords: {
    label: "关键词导演",
    desc: "按主体、环境、服装、镜头和风格逐层组织画面。",
    eyebrow: "Guided Prompting",
  },
  img2img: {
    label: "参考图编辑",
    desc: "保留参考图结构，只改服装、姿态、风格或镜头。",
    eyebrow: "Image Edit",
  },
  video: {
    label: "视频生成",
    desc: "支持文本、参考图和关键帧模式，适配 Agnes 视频参数。",
    eyebrow: "Motion Studio",
  },
} as const;

function getImageSize(keywords: string[]): string {
  const ratio = SIZE_MAP.find(([p]) => keywords.some((k) => k.includes(p)));
  const tiers = ratio ? SIZE_TIERS[ratio[0]] : SIZE_TIERS["1:1"];
  const key = keywords.find((k) => tiers[k.match(/\d+/)?.[0] || ""]);
  if (key) {
    const num = key.match(/\d+/)?.[0] || "";
    if (tiers[num]) return tiers[num];
  }
  return ratio ? ratio[1] : "1024x1024";
}

function findFacetByKeyword(groups: KeywordGroup[], keyword: string): KeywordFacet | null {
  for (const group of groups) {
    for (const facet of group.facets || []) {
      if (facet.keywords.some((kw) => kw.name === keyword)) return facet;
    }
  }
  return null;
}

function getOutputKeywords(groups: KeywordGroup[], selected: string[]) {
  const outputGroup = groups.find((group) => group.slug === "output");
  if (!outputGroup) return [];
  const outputSet = new Set(outputGroup.keywords.map((kw) => kw.name));
  return selected.filter((keyword) => outputSet.has(keyword));
}

function getSemanticKeywords(groups: KeywordGroup[], selected: string[]) {
  const outputSet = new Set(getOutputKeywords(groups, selected));
  return selected.filter((keyword) => !outputSet.has(keyword));
}

interface TaskRecord {
  id: number;
  status: string;
  type: string;
  keywordNames: string;
  prompt: string;
  imagePath: string;
  videoPath: string;
  posterPath: string;
  progress: number;
  error: string;
}

export default function HomePage() {
  const [groups, setGroups] = useState<KeywordGroup[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [records, setRecords] = useState<ImageRecord[]>([]);
  const [loggedIn, setLoggedIn] = useState(false);
  const [mode, setMode] = useState<"keywords" | "img2img" | "video">("keywords");
  const [refImages, setRefImages] = useState<string[]>([]);
  const [videoRefImages, setVideoRefImages] = useState<string[]>([]);
  const [videoMode, setVideoMode] = useState<"reference" | "keyframes">("reference");
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [videoWidth, setVideoWidth] = useState(1920);
  const [videoHeight, setVideoHeight] = useState(1080);
  const [videoFrames, setVideoFrames] = useState(121);
  const [videoFps, setVideoFps] = useState(24);
  const [liveTasks, setLiveTasks] = useState<TaskRecord[]>([]);
  const [showLogin, setShowLogin] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const textActionLock = useRef(false);

  const fetchGroups = useCallback(async () => {
    try {
      const res = await fetch("/api/keywords");
      const data = await res.json();
      if (data.success) setGroups(data.data);
    } catch {}
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/history");
      const data = await res.json();
      if (data.success) setRecords(data.data);
    } catch {}
  }, []);

  const fetchLiveTasks = useCallback(async () => {
    try {
      const res = await fetch("/api/tasks?status=pending,processing,failed");
      const data = await res.json();
      if (data.success) setLiveTasks(data.data);
    } catch {}
  }, []);

  const startPolling = useCallback(() => {
    if (pollingRef.current) return;
    let emptyCount = 0;
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/tasks?status=pending,processing,failed");
        const data = await res.json();
        if (data.success) {
          setLiveTasks(data.data);
          const active = data.data.filter((t: TaskRecord) => t.status === "pending" || t.status === "processing");
          fetchHistory();
          if (active.length === 0) {
            emptyCount++;
            if (emptyCount >= 1 && pollingRef.current) {
              clearInterval(pollingRef.current);
              pollingRef.current = null;
            }
          } else {
            emptyCount = 0;
          }
        }
      } catch {}
    }, 3000);
  }, [fetchHistory]);

  useEffect(() => {
    fetchGroups();
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.data) {
          setLoggedIn(true);
          fetchHistory();
          fetchLiveTasks();
          startPolling();
        }
        setAuthChecked(true);
      })
      .catch(() => setAuthChecked(true));
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [fetchGroups, fetchHistory, fetchLiveTasks, startPolling]);

  const toggleKeyword = (keyword: string) => {
    const facet = findFacetByKeyword(groups, keyword);
    if (!facet) {
      setSelected((prev) => (prev.includes(keyword) ? prev.filter((k) => k !== keyword) : [...prev, keyword]));
      return;
    }

    setSelected((prev) => {
      const active = prev.includes(keyword);
      if (active) return prev.filter((item) => item !== keyword);

      const facetKeywordSet = new Set(facet.keywords.map((item) => item.name));
      const currentFacetSelected = prev.filter((item) => facetKeywordSet.has(item));

      if (facet.selectionMode === "single") {
        return [...prev.filter((item) => !facetKeywordSet.has(item)), keyword];
      }

      const maxSelect = facet.maxSelect || facet.keywords.length;
      if (currentFacetSelected.length >= maxSelect) {
        const trimmed = prev.filter((item) => !currentFacetSelected.includes(item));
        return [...trimmed, ...currentFacetSelected.slice(1), keyword];
      }

      return [...prev, keyword];
    });
  };

  const clearSelectedKeywords = () => setSelected([]);

  const handleGeneratePrompt = async () => {
    if (textActionLock.current) return;
    const semanticKeywords = getSemanticKeywords(groups, selected);
    if (semanticKeywords.length === 0) {
      alert("请至少选择一个主体或画面关键词");
      return;
    }
    if (!loggedIn) {
      setShowLogin(true);
      return;
    }
    setLoading(true);
    setStatusText("正在生成提示词...");
    setPrompt("");
    textActionLock.current = true;
    try {
      // Include all selected keywords (semantic + output) so the LLM knows about ratio/resolution
      const structured = selected.map((name) => {
        for (const group of groups) {
          const facet = (group.facets || []).find((item) => item.keywords.some((kw) => kw.name === name));
          if (facet) {
            return { name, groupSlug: group.slug, facetSlug: facet.slug };
          }
        }
        return { name, groupSlug: null, facetSlug: null };
      });
      const res = await fetch("/api/generate-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywords: structured, mode }),
      });
      const data = await res.json();
      if (data.success) {
        setPrompt(data.data.prompt);
      } else {
        alert(data.error || "生成失败");
      }
    } catch {
      alert("生成出错");
    } finally {
      setLoading(false);
      setStatusText("");
      textActionLock.current = false;
    }
  };


  const handleGenerate = async () => {
    if (!loggedIn) {
      setShowLogin(true);
      return;
    }

    const body: Record<string, unknown> = { type: mode, size: "1024x1024" };
    const semanticKeywords = getSemanticKeywords(groups, selected);

    if (mode === "video") {
      body.width = videoWidth;
      body.height = videoHeight;
      body.num_frames = videoFrames;
      body.frame_rate = videoFps;
      body.video_mode = videoMode;
    }

    if (mode === "keywords" || mode === "img2img") {
      if (mode === "keywords" && semanticKeywords.length === 0 && !prompt.trim()) {
        alert("请至少选择一个关键词或输入提示词");
        return;
      }
      if (mode === "img2img" && semanticKeywords.length === 0 && !prompt.trim()) {
        alert("请至少选择关键词或输入编辑指令");
        return;
      }
      body.keywords = semanticKeywords.join(", ");
      body.size = getImageSize(selected);
      if (prompt.trim()) body.prompt = prompt.trim();
    } else if (mode === "video") {
      if (!prompt.trim()) {
        alert("请输入提示词");
        return;
      }
      body.keywords = prompt.trim();
      body.prompt = prompt.trim();
    }

    if (mode === "img2img") {
      if (refImages.length === 0) {
        alert("请至少添加一张参考图");
        return;
      }
      body.image = refImages;
    } else if (mode === "video" && videoRefImages.length > 0) {
      if (videoMode === "keyframes" && videoRefImages.length < 2) {
        alert("关键帧动画至少需要两张图片 URL");
        return;
      }
      body.image = videoRefImages;
    }

    const tempId = -(Date.now() + Math.floor(Math.random() * 1000));
    const tempTask = {
      id: tempId,
      status: "pending",
      type: mode,
      keywordNames:
        mode === "keywords"
          ? semanticKeywords.join(", ")
          : mode === "img2img"
            ? semanticKeywords.join(", ") || "参考图编辑"
            : "手动输入",
      prompt: (body.prompt as string) || "",
      imagePath: "",
      videoPath: "",
      posterPath: "",
      progress: 0,
      error: "",
    };
    setLiveTasks((prev) => [tempTask, ...prev]);
    startPolling();

    void (async () => {
      try {
        const res = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!data.success) {
          throw new Error(data.error || "创建失败");
        }

        setLiveTasks((prev) => prev.map((task) =>
          task.id === tempId
            ? { ...task, id: data.data.taskId, status: "processing" }
            : task
        ));
        startPolling();
      } catch (error) {
        const message = error instanceof Error ? error.message : "创建失败";
        setLiveTasks((prev) => prev.map((task) =>
          task.id === tempId
            ? { ...task, status: "failed", error: message }
            : task
        ));
      }
    })();
  };

  const handleDeleteHistory = async (id: number) => {
    if (!confirm("确定删除吗？")) return;
    try {
      await fetch(`/api/history?id=${id}`, { method: "DELETE" });
      fetchHistory();
    } catch {}
  };

  const handleDeleteTask = async (id: number) => {
    try {
      await fetch(`/api/tasks?id=${id}`, { method: "DELETE" });
      setLiveTasks((prev) => prev.filter((t) => t.id !== id));
    } catch {}
  };

  const handleRetryTask = async (id: number) => {
    try {
      const res = await fetch("/api/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.success) {
        setLiveTasks((prev) => prev.map((t) => t.id === id ? { ...t, status: "pending", progress: 0, error: "" } : t));
        startPolling();
      } else {
        alert(data.error || "重试失败");
      }
    } catch {
      alert("重试失败");
    }
  };

  const handlePolish = async () => {
    if (textActionLock.current) return;
    if (!prompt.trim()) {
      alert("请先输入内容");
      return;
    }
    setStatusText("AI 润色中...");
    setLoading(true);
    textActionLock.current = true;
    try {
      const res = await fetch("/api/polish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: prompt, mode }),
      });
      const data = await res.json();
      if (data.success) setPrompt(data.data.text);
      else alert(data.error || "润色失败");
    } catch {
      alert("润色出错");
    } finally {
      setLoading(false);
      setStatusText("");
      textActionLock.current = false;
    }
  };

  const tabs = [
    { key: "keywords", label: "关键词生图", desc: "标签组合生成提示词" },
    { key: "img2img", label: "参考图生图", desc: "上传或粘贴参考图" },
    { key: "video", label: "视频生成", desc: "文生视频/图生视频/关键帧" },
  ] as const;

  const activeTasks = liveTasks.filter((task) => task.status === "pending" || task.status === "processing");
  const failedTasks = liveTasks.filter((task) => task.status === "failed");
  const currentMode = tabs.find((tab) => tab.key === mode);
  const semanticSelected = getSemanticKeywords(groups, selected);
  const outputSelected = getOutputKeywords(groups, selected);
  const outputSize = selected.length > 0 && (mode === "keywords" || mode === "img2img") ? getImageSize(selected) : null;
  const videoDuration = (videoFrames / videoFps).toFixed(1);
  const queueTasks = [...activeTasks, ...failedTasks];

  return (
    <>
      {/* ═══════════ DESKTOP ═══════════ */}
      <div className="hidden lg:flex lg:flex-col lg:h-screen lg:overflow-hidden">
        <Header />

        {/* ═══ Welcome Hero — logged-out ═══ */}
        {!authChecked ? (
          <div className="shrink-0 flex items-center justify-center py-20"><div className="w-6 h-6 border-2 rounded-full animate-spin" style={{"borderColor": "var(--border)", "borderTopColor": "var(--accent)"}} /></div>
        ) : !loggedIn ? (
          <div className="shrink-0 relative overflow-hidden border-b border-app-border/40" style={{"background": "linear-gradient(135deg, rgba(217,107,43,0.08) 0%, rgba(16,22,24,1) 40%, rgba(136,192,168,0.05) 70%, rgba(16,22,24,1) 100%)"}}>
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <div className="absolute -top-20 -left-20 w-64 h-64 rounded-full opacity-[0.06]" style={{"background": "radial-gradient(circle, var(--accent) 0%, transparent 70%)"}} />
              <div className="absolute -bottom-16 right-[20%] w-48 h-48 rounded-full opacity-[0.04]" style={{"background": "radial-gradient(circle, var(--highlight) 0%, transparent 70%)"}} />
              <div className="absolute top-0 right-0 w-96 h-full opacity-[0.03]" style={{"background": "linear-gradient(90deg, transparent 0%, var(--accent) 30%, transparent 100%)"}} />
            </div>
            <div className="relative px-5 py-6 sm:px-8 sm:py-8">
              <div className="max-w-3xl">
                <div className="flex items-center gap-2 mb-3">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-[0.2em]" style={{"background": "var(--accent-light)", "color": "var(--accent)"}}>✦ AI 创意工坊</span>
                  <span className="text-[10px] uppercase tracking-[0.15em] text-app-text3">Text to Image Studio</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2" style={{"color": "var(--text-primary)"}}>文生图<span style={{"color": "var(--accent)"}}>工作室</span></h1>
                <p className="text-sm sm:text-base leading-relaxed max-w-lg mb-5" style={{"color": "var(--text-secondary)"}}>选择关键词，让 AI 为你生成精美画面。支持关键词导演、参考图编辑和视频生成三种创作模式。</p>
                <div className="flex flex-wrap items-center gap-3">
                  {tabs.map((tab) => (
                    <button key={tab.key} type="button" onClick={() => setMode(tab.key)}
                      className="flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
                      style={{"background": tab.key === mode ? "var(--accent-light)" : "rgba(255,255,255,0.03)", "borderColor": tab.key === mode ? "var(--accent)" : "var(--border)", "color": tab.key === mode ? "var(--accent)" : "var(--text-secondary)", "boxShadow": tab.key === mode ? "0 0 20px var(--accent-glow)" : "none"}}>
                      <span className="text-base">{{"keywords": "🎨", "img2img": "🖼️", "video": "🎬"}[tab.key as "keywords" | "img2img" | "video"]}</span>
                      <span>{tab.label}</span>
                    </button>
                  ))}
                  <button onClick={() => setShowLogin(true)}
                    className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.98]"
                    style={{"background": "linear-gradient(135deg, var(--accent), var(--accent-hover))", "boxShadow": "0 4px 20px var(--accent-glow)"}}>
                    <span>🔐</span><span>登录开始创作</span><span className="text-xs opacity-80 ml-1">→</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : <>{/* Stats bar */}
        <div className="shrink-0 flex items-center gap-3 border-b border-app-border/40 bg-[var(--bg-secondary)] px-5 py-2">
          <span className="text-[10px] uppercase tracking-[0.2em] text-app-text3 shrink-0 font-semibold">{MODE_META[mode].eyebrow}</span>
          <span className="h-4 w-px bg-app-border/30 shrink-0" />
          <span className="text-xs text-app-text2 font-medium">{currentMode?.label ?? "关键词导演"}</span>
          <div className="ml-auto flex items-center gap-2.5">
            <div className="flex items-center gap-1.5 rounded-full px-2.5 py-1" style={{ background: semanticSelected.length > 0 ? "var(--accent-light)" : "var(--bg-tertiary)" }}>
              <span className="text-[10px] text-app-text3">词</span>
              <span className="text-[11px] font-mono font-semibold" style={{ color: semanticSelected.length > 0 ? "var(--accent)" : "var(--text-secondary)" }}>{groups.length === 0 ? "\u2026" : semanticSelected.length}</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-full px-2.5 py-1" style={{ background: "var(--bg-tertiary)" }}>
              <span className="text-[10px] text-app-text3">输出</span>
              <span className="text-[11px] font-mono font-medium text-app-text2">{mode === "video" ? `${videoWidth}\u00d7${videoHeight}` : outputSize || "1024"}</span>
            </div>
            <span className="h-4 w-px bg-app-border/30 shrink-0" />
            <div className="flex items-center gap-1.5 rounded-full px-2.5 py-1" style={{ background: activeTasks.length > 0 ? "var(--accent-light)" : "var(--bg-tertiary)" }}>
              <span className="text-[10px] text-app-text3">队列</span>
              <span className="text-[11px] font-mono font-semibold" style={{ color: activeTasks.length > 0 ? "var(--accent)" : "var(--text-secondary)" }}>{activeTasks.length}</span>
              {failedTasks.length > 0 && <span className="text-[11px] font-mono font-semibold text-[var(--danger)]">/{failedTasks.length}</span>}
            </div>
            <div className="flex items-center gap-1.5 rounded-full px-2.5 py-1" style={{ background: records.length > 0 ? "rgba(34,197,94,0.08)" : "var(--bg-tertiary)" }}>
              <span className="text-[10px] text-app-text3">成品</span>
              <span className="text-[11px] font-mono font-semibold" style={{ color: records.length > 0 ? "var(--success)" : "var(--text-secondary)" }}>{records.length}</span>
            </div>
          </div>
        </div>{/* Three-column main area */}
        <div className="flex-1 flex min-h-0 overflow-hidden">

          {/* ── LEFT SIDEBAR (17%) ── */}
          <aside className="w-[17%] min-w-[200px] max-w-[270px] border-r border-app-border/40 overflow-y-auto">
            <div className="p-4 space-y-4">
              <div className="space-y-1">
                {tabs.map((tab) => {
                  const active = tab.key === mode;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setMode(tab.key)}
                      className="w-full rounded-md px-3 py-3 text-left transition-base"
                      style={{
                        background: active ? "var(--accent-light)" : "transparent",
                        borderLeft: active ? "2px solid var(--accent)" : "2px solid transparent",
                      }}
                    >
                      <div className="flex items-center text-sm font-medium" style={{ color: active ? "var(--accent)" : "var(--text-secondary)" }}>
                        <span className="mr-2 text-base">{tab.key === "keywords" ? "🎨" : tab.key === "img2img" ? "🖼️" : "🎬"}</span>
                        {tab.label}
                      </div>
                      <div className="mt-1 text-[11px] text-app-text3 leading-relaxed">{tab.desc}</div>
                    </button>
                  );
                })}
              </div>

              <hr className="divider" />

              <div>
                <div className="text-[11px] uppercase tracking-[0.16em] text-app-text3 mb-2">输出规格</div>
                <div className="panel-soft rounded-lg p-3.5">
                  <div className="text-sm font-mono font-medium text-app-text">
                    {mode === "video" ? `${videoWidth}×${videoHeight}` : outputSize || "1024×1024"}
                  </div>
                  <div className="mt-1 text-[11px] text-app-text3">
                    {mode === "video" ? `${videoFrames}f / ${videoFps}fps / ${videoDuration}s` : outputSelected.length > 0 ? `${outputSelected.length} 参数` : "默认"}
                  </div>
                </div>
              </div>
            </div>
          </aside>

          {/* ── CENTER ── */}
          <main className="flex-1 min-w-0 flex flex-col">
            {/* Scrollable area */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-4 space-y-5">

                {/* Mode-dependent params */}
                {(mode === "keywords" || mode === "img2img") && (
                  <div className="animate-fade-in">
                    {mode === "img2img" && (
                      <div className="panel-soft rounded-lg p-4 mb-3">
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <span className="text-sm font-medium text-app-text2">参考图输入</span>
                          <span className="text-xs text-app-text3">{refImages.length} 张</span>
                        </div>
                        <ImageUploader images={refImages} onChange={setRefImages} />
                      </div>
                    )}

                    <KeywordSelector groups={groups} selected={selected} onToggle={toggleKeyword} onClear={clearSelectedKeywords} />

                    {selected.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {selected.map((keyword) => (
                          <button
                            key={keyword}
                            type="button"
                            onClick={() => toggleKeyword(keyword)}
                            className="rounded-md border px-3 py-1.5 text-xs font-medium transition-base"
                            style={{ borderColor: "var(--accent)", background: "var(--accent-light)", color: "var(--accent)" }}
                          >
                            {keyword} ×
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {mode === "video" && (
                  <div className="space-y-4 animate-fade-in">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setVideoMode("reference")}
                        className="rounded-md px-3 py-1.5 text-xs font-medium transition-base"
                        style={{
                          background: videoMode === "reference" ? "var(--accent-light)" : "var(--bg-tertiary)",
                          color: videoMode === "reference" ? "var(--accent)" : "var(--text-secondary)",
                        }}
                      >参考图</button>
                      <button
                        type="button"
                        onClick={() => setVideoMode("keyframes")}
                        className="rounded-md px-3 py-1.5 text-xs font-medium transition-base"
                        style={{
                          background: videoMode === "keyframes" ? "var(--accent-light)" : "var(--bg-tertiary)",
                          color: videoMode === "keyframes" ? "var(--accent)" : "var(--text-secondary)",
                        }}
                      >关键帧</button>
                      <span className="ml-auto text-xs text-app-text3">{videoWidth}×{videoHeight} | {videoFrames}f/{videoFps}fps | {videoDuration}s</span>
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                      <label className="block">
                        <span className="text-[11px] text-app-text3">宽</span>
                        <select value={videoWidth} onChange={(e) => setVideoWidth(Number(e.target.value))}
                          className="mt-1 w-full rounded-md border border-app-border/60 bg-[var(--bg-tertiary)] px-2 py-2 text-xs text-app-text focus:outline-none">
                          <option value={768}>768</option><option value={1080}>1080</option><option value={1152}>1152</option><option value={1920}>1920</option>
                        </select>
                      </label>
                      <label className="block">
                        <span className="text-[11px] text-app-text3">高</span>
                        <select value={videoHeight} onChange={(e) => setVideoHeight(Number(e.target.value))}
                          className="mt-1 w-full rounded-md border border-app-border/60 bg-[var(--bg-tertiary)] px-2 py-2 text-xs text-app-text focus:outline-none">
                          <option value={576}>576</option><option value={768}>768</option><option value={1080}>1080</option><option value={1152}>1152</option>
                        </select>
                      </label>
                      <label className="block">
                        <span className="text-[11px] text-app-text3">帧数</span>
                        <select value={videoFrames} onChange={(e) => setVideoFrames(Number(e.target.value))}
                          className="mt-1 w-full rounded-md border border-app-border/60 bg-[var(--bg-tertiary)] px-2 py-2 text-xs text-app-text focus:outline-none">
                          <option value={81}>81</option><option value={121}>121</option><option value={201}>201</option><option value={401}>401</option>
                        </select>
                      </label>
                      <label className="block">
                        <span className="text-[11px] text-app-text3">fps</span>
                        <select value={videoFps} onChange={(e) => setVideoFps(Number(e.target.value))}
                          className="mt-1 w-full rounded-md border border-app-border/60 bg-[var(--bg-tertiary)] px-2 py-2 text-xs text-app-text focus:outline-none">
                          <option value={8}>8</option><option value={16}>16</option><option value={24}>24</option><option value={30}>30</option>
                        </select>
                      </label>
                    </div>

                    <ImageUploader images={videoRefImages} onChange={setVideoRefImages} allowUpload={false} allowDataUri={false} hint="公网URL" />
                  </div>
                )}

                {/* Gallery */}
                <div className="pt-3 border-t border-app-border/30">
                  <MasonryGallery records={records} liveTasks={liveTasks} onDelete={handleDeleteHistory} onDeleteTask={handleDeleteTask} onImageClick={(r) => setViewerIndex(records.indexOf(r))} loading={loading} />
                </div>
              </div>
            </div>

            {/* ── STICKY CONSOLE (bottom) ── */}
            <div className="shrink-0 border-t border-app-border/40 bg-[var(--bg-secondary)]/95 backdrop-blur-xl">
              <div className="p-4 space-y-3">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={3}
                  className="w-full resize-none rounded-md border border-app-border/60 bg-[var(--bg-tertiary)] px-4 py-3 text-sm leading-relaxed text-app-text placeholder:text-app-text3 focus:border-[var(--accent)] focus:outline-none"
                  placeholder={
                    mode === "video"
                      ? "🎬 描述画面主体、动作、镜头运动和光线变化..."
                      : mode === "img2img"
                      ? "🖼️ 描述保留什么、改动什么，如：把外套改成红色..."
                      : "✨ 选好关键词后点「生成提示词」获取底稿，或直接手写描述..."
                  }
                />

                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 text-xs text-app-text3">
                    <span className="font-mono tabular-nums">{prompt.length} 字符</span>
                    <span className="font-mono">{mode === "video" ? `${videoDuration}s` : outputSize || "1024"}</span>
                    <span style={{ color: loggedIn ? "var(--success)" : "var(--text-muted)" }}>{loggedIn ? "已登录" : "未登录"}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {(mode === "keywords" || mode === "img2img") && (
                      <button
                        onClick={handleGeneratePrompt}
                        disabled={loading || selected.length === 0 || !loggedIn}
                        className="rounded-md border border-app-border/60 px-4 py-2 text-xs font-medium text-app-text3 transition-base hover:border-[var(--border-hover)] hover:text-app-text2 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        {loading && statusText === "正在生成提示词..." ? "生成中" : "生成提示词"}
                      </button>
                    )}
                    <button
                      onClick={handlePolish}
                      disabled={loading || !prompt.trim()}
                      className="rounded-md border border-app-border/60 px-3 py-2 text-xs font-medium text-app-text3 transition-base hover:border-[var(--border-hover)] hover:text-app-text2 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      {loading && statusText === "AI 润色中..." ? "润色中" : "AI 润色"}
                    </button>
                    <button
                      onClick={handleGenerate}
                      disabled={!loggedIn || (!prompt.trim() && mode !== "img2img")}
                      className="rounded-md bg-[var(--accent)] px-5 py-2 text-xs font-semibold text-white transition-base hover:bg-[var(--accent-hover)] hover:shadow-[0_0_12px_var(--accent-glow)] disabled:bg-[var(--bg-tertiary)] disabled:text-app-text3 disabled:shadow-none disabled:cursor-not-allowed"
                    >
                      {!loggedIn
                        ? "🔐 请先登录"
                        : mode === "video"
                          ? "🎬 提交视频"
                          : "✨ 提交生成"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </main>

          {/* ── RIGHT SIDEBAR (17%) ── */}
          <aside className="w-[17%] min-w-[200px] max-w-[270px] border-l border-app-border/40 overflow-y-auto">
            <div className="p-4 space-y-3">
              <div className="text-[11px] uppercase tracking-[0.16em] text-app-text3">任务队列</div>

              <div className="grid grid-cols-3 gap-1.5">
                <div className="panel-soft rounded-lg px-2 py-3 text-center">
                  <div className="text-sm font-mono font-semibold text-app-text">{activeTasks.length}</div>
                  <div className="text-[10px] text-app-text3 mt-0.5">进行中</div>
                </div>
                <div className="panel-soft rounded-lg px-2 py-3 text-center">
                  <div className="text-sm font-mono font-semibold text-app-text">{failedTasks.length}</div>
                  <div className="text-[10px] text-app-text3 mt-0.5">失败</div>
                </div>
                <div className="panel-soft rounded-lg px-2 py-3 text-center">
                  <div className="text-sm font-mono font-semibold text-app-text">{records.length}</div>
                  <div className="text-[10px] text-app-text3 mt-0.5">成品</div>
                </div>
              </div>

              {queueTasks.length === 0 ? (
                <div className="py-10 text-center">
                  <div className="flex flex-col items-center gap-2">
                  <span className="text-2xl opacity-30">📭</span>
                  <p className="text-xs text-app-text3">暂无排队任务</p>
                  <p className="text-[10px] text-app-text3/60">选择关键词后提交生成</p>
                </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {queueTasks.map((task) => (
                    <div key={task.id} className="panel-soft rounded-lg p-3 space-y-2 animate-fade-in">
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-mono text-app-text3">#{task.id}</span>
                          <span className="rounded px-1.5 py-0.5 text-[10px] font-medium" style={{ background: task.type === "video" ? "var(--accent-light)" : "var(--success-bg)", color: task.type === "video" ? "var(--accent)" : "var(--success)" }}>
                            {task.type === "video" ? "V" : "I"}
                          </span>
                        </div>
                        <span className="text-[10px]" style={{ color: task.status === "failed" ? "var(--danger)" : task.status === "processing" ? "var(--accent)" : "var(--text-muted)" }}>
                          {task.status === "failed" ? "失败" : task.status === "processing" ? "处理中" : "排队"}
                        </span>
                      </div>

                      <p className="text-xs leading-relaxed text-app-text2 line-clamp-2">{task.prompt || task.keywordNames || "…"}</p>

                      <div className="h-1.5 rounded-full overflow-hidden bg-[var(--bg-tertiary)]">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.max(4, Math.min(100, task.progress || (task.status === "failed" ? 100 : 8)))}%`,
                            background: task.status === "failed" ? "var(--danger)" : "var(--accent)",
                          }}
                        />
                      </div>

                      {task.error && (
                        <p className="text-[11px] leading-4 text-[var(--danger)] line-clamp-2">{task.error}</p>
                      )}

                      <div className="flex gap-2">
                        {task.status === "failed" && (
                          <button onClick={() => handleRetryTask(task.id)} className="text-[10px] text-[var(--accent)] transition-base hover:text-[var(--accent-hover)]">
                            重试
                          </button>
                        )}
                        <button onClick={() => handleDeleteTask(task.id)} className="text-[10px] text-app-text3 transition-base hover:text-[var(--danger)]">
                          删除
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>

        </div></>}

        {/* Login modal */}
        {showLogin && (
          <LoginModal
            onClose={() => setShowLogin(false)}
            onSuccess={() => {
              setShowLogin(false);
              setLoggedIn(true);
              fetchHistory();
              fetchLiveTasks();
              startPolling();
            }}
          />
        )}
      </div>

      {/* ═══════════ MOBILE ═══════════ */}
      
      {viewerIndex !== null && <FullscreenViewer records={records} activeIndex={viewerIndex} onClose={() => setViewerIndex(null)} onDelete={(id) => { handleDeleteHistory(id); setViewerIndex(null); }} />}
<div className="lg:hidden">
        <MobileHome
          loggedIn={loggedIn}
          groups={groups}
          selected={selected}
          onToggleKeyword={toggleKeyword}
          onClearKeywords={clearSelectedKeywords}
          prompt={prompt}
          onPromptChange={setPrompt}
          loading={loading}
          statusText={statusText}
          mode={mode}
          onModeChange={setMode}
          records={records}
          liveTasks={liveTasks}
          onGeneratePrompt={handleGeneratePrompt}
          onGenerate={handleGenerate}
          onPolish={handlePolish}
          onDeleteHistory={handleDeleteHistory}
          onDeleteTask={handleDeleteTask}
          onRetryTask={handleRetryTask}
          refImages={refImages}
          onRefImagesChange={setRefImages}
          videoRefImages={videoRefImages}
          onVideoRefImagesChange={setVideoRefImages}
          videoMode={videoMode}
          onVideoModeChange={setVideoMode}
          videoWidth={videoWidth}
          onVideoWidthChange={setVideoWidth}
          videoHeight={videoHeight}
          onVideoHeightChange={setVideoHeight}
          videoFrames={videoFrames}
          onVideoFramesChange={setVideoFrames}
          videoFps={videoFps}
          onVideoFpsChange={setVideoFps}
          outputSize={outputSize}
          videoDuration={videoDuration}
          onLoginSuccess={() => {
            setLoggedIn(true);
            fetchHistory();
            fetchLiveTasks();
            startPolling();
          }}
        />
      </div>
    </>
  );
}
