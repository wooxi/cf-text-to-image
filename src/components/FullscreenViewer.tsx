"use client";

import { useState, useEffect, useRef } from "react";
import { ImageRecord } from "@/types";

interface Props {
  records: ImageRecord[];
  activeIndex: number;
  onClose: () => void;
  onDelete?: (id: number) => void;
}

export default function FullscreenViewer({ records, activeIndex, onClose, onDelete }: Props) {
  const [showDetail, setShowDetail] = useState(false);
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(activeIndex);

  // Sync scroll position to initial index
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = activeIndex * scrollRef.current.clientWidth;
    }
  }, [activeIndex]);

  // Update index on scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const idx = Math.round(el.scrollLeft / el.clientWidth);
      if (idx >= 0 && idx < records.length) setCurrentIndex(idx);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [records.length]);

  const record = records[currentIndex];
  if (!record) return null;

  const isVideo = record.type === "video" || /\.(mp4|webm|mov)$/i.test(record.imagePath);
  const src = isVideo ? (record.posterPath || record.imagePath) : record.imagePath;

  const handleDownload = async () => {
    const url = isVideo ? record.imagePath : src;
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = url.split("/").pop() || "download";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch {
      const a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.download = url.split("/").pop() || "download";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const handleShare = async () => {
    const url = isVideo ? record.imagePath : src;
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const file = new File([blob], url.split("/").pop() || "image.png", { type: blob.type });
      await navigator.share({
        files: [file],
        title: "AI 文生图",
        text: record.prompt || record.keywordNames || "",
      });
    } catch {
      // Fallback: share just the text
      try {
        await navigator.share({
          title: "AI 文生图",
          text: record.prompt || record.keywordNames || "",
          url: src,
        });
      } catch {
        // User cancelled or not supported
      }
    }
  };

  const handleCopy = async () => {
    const text = record.prompt || record.keywordNames;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      } catch {}
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const scrollTo = (idx: number) => {
    scrollRef.current?.scrollTo({ left: idx * (scrollRef.current?.clientWidth || 0), behavior: "smooth" });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* ── Top bar ── */}
      <div
        className="absolute top-0 inset-x-0 z-[60] flex items-center justify-between px-5 py-3"
        style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}
      >
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full bg-white/20 text-white flex items-center justify-center"
        >
          ✕
        </button>

        {/* Dot indicators */}
        {records.length > 1 && (
          <div className="flex gap-1.5">
            {records.map((_, i) => (
              <button
                key={i}
                onClick={() => scrollTo(i)}
                className="w-1.5 h-1.5 rounded-full transition-base"
                style={{
                  background: i === currentIndex ? "#fff" : "rgba(255,255,255,0.35)",
                  transform: i === currentIndex ? "scale(1.4)" : "scale(1)",
                }}
              />
            ))}
          </div>
        )}

        <span className="text-white/60 text-xs tabular-nums min-w-[40px] text-right">
          {currentIndex + 1}/{records.length}
        </span>
      </div>

      {/* ── Image scroll-snap area ── */}
      <div
        ref={scrollRef}
        className="flex-1 flex overflow-x-auto snap-x snap-mandatory scrollbar-none overscroll-x-contain"
        style={{ scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch" }}
      >
        {records.map((r, i) => {
          const isV = r.type === "video" || /\.(mp4|webm|mov)$/i.test(r.imagePath);
          const imgSrc = isV ? (r.posterPath || r.imagePath) : r.imagePath;

          return (
            <div
              key={r.id}
              className="flex-none w-full h-full snap-center flex items-center justify-center"
            >
              {isV ? (
                <video
                  src={r.imagePath}
                  controls
                  className="max-w-full max-h-full object-contain"
                  playsInline
                />
              ) : (
                <img
                  src={imgSrc}
                  alt={r.prompt || r.keywordNames}
                  className="max-w-full max-h-full object-contain"
                  loading="lazy"
                />
              )}
            </div>
          );
        })}
      </div>

      {/* ── Nav arrows ── */}
      {records.length > 1 && (
        <>
          <button
            onClick={() => scrollTo(Math.max(0, currentIndex - 1))}
            disabled={currentIndex === 0}
            className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white/15 text-white flex items-center justify-center disabled:opacity-20"
          >
            ‹
          </button>
          <button
            onClick={() => scrollTo(Math.min(records.length - 1, currentIndex + 1))}
            disabled={currentIndex === records.length - 1}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white/15 text-white flex items-center justify-center disabled:opacity-20"
          >
            ›
          </button>
        </>
      )}

      {/* ── Bottom action bar ── */}
      <div
        className="absolute bottom-0 inset-x-0 z-[60] pb-4 px-4 flex items-center justify-center gap-3"
        style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => setShowDetail(!showDetail)}
          className="px-4 py-2.5 rounded-full bg-white/15 text-white text-sm backdrop-blur transition-base"
        >
          {showDetail ? "收起" : "详情"}
        </button>
        {typeof navigator !== "undefined" && "share" in navigator && (
          <button
            onClick={handleShare}
            className="px-4 py-2.5 rounded-full bg-white/15 text-white text-sm backdrop-blur transition-base"
          >
            分享
          </button>
        )}
        <button
          onClick={handleDownload}
          className="px-4 py-2.5 rounded-full bg-white/15 text-white text-sm backdrop-blur transition-base"
        >
          {isVideo ? "下载" : "下载"}
        </button>
      </div>

      {/* ── Detail panel + backdrop ── */}
      {showDetail && (
        <>
          {/* Backdrop — tap to dismiss */}
          <div
            className="absolute inset-0 z-20"
            onClick={() => setShowDetail(false)}
          />
          <div
            className="absolute bottom-0 inset-x-0 z-30 bg-[#1a1a1a] rounded-t-2xl max-h-[50vh] overflow-y-auto animate-slide-up"
            style={{
              boxShadow: "0 -4px 24px rgba(0,0,0,0.5)",
              paddingBottom: "max(16px, env(safe-area-inset-bottom))",
            }}
            onClick={(e) => e.stopPropagation()}
          >
          <div className="flex items-center justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-white/30" />
          </div>

          <div className="px-5 pb-6">
            {record.keywordNames && (
              <div className="mb-4">
                <p className="text-xs text-white/50 mb-2">关键词</p>
                <div className="flex flex-wrap gap-1.5">
                  {record.keywordNames.split(", ").map((kw) => (
                    <span key={kw} className="px-2.5 py-1 rounded-full text-xs bg-white/10 text-white/80">
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-4">
              <p className="text-xs text-white/50 mb-2">提示词</p>
              <p className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap break-all">
                {record.prompt || record.keywordNames}
              </p>
            </div>

            <div className="flex gap-3 mt-4">
              <button
                onClick={handleCopy}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium transition-base"
                style={{ background: copied ? "#22c55e" : "rgba(255,255,255,0.15)", color: "#fff" }}
              >
                {copied ? "已复制" : "复制提示词"}
              </button>
              <button
                onClick={handleDownload}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium transition-base bg-white/15 text-white"
              >
                {isVideo ? "下载视频" : "下载图片"}
              </button>
              {onDelete && (
                <button
                  onClick={() => { onDelete(record.id); onClose(); }}
                  className="flex-1 py-2.5 rounded-lg text-sm font-medium transition-base bg-red-500/30 text-red-300"
                >
                  删除
                </button>
              )}
            </div>
          </div>
        </div>
        </>
      )}

      <style jsx>{`
        .scrollbar-none::-webkit-scrollbar { display: none; }
        .scrollbar-none { scrollbar-width: none; -ms-overflow-style: none; }
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slideUp 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
