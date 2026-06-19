"use client";

import { useState, useRef, useEffect } from "react";
import { ImageRecord } from "@/types";
import Lightbox from "./Lightbox";

interface Props {
  record: ImageRecord;
  onDelete: (id: number) => void;
  posterPath?: string;
  onImageClick?: (record: ImageRecord) => void;
}

function isVideo(path: string) { return /\.(mp4|webm|mov)$/i.test(path); }

export default function ImageCard({ record, onDelete, posterPath, onImageClick }: Props) {
  const [showLightbox, setShowLightbox] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [inView, setInView] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const video = record.type === "video" || isVideo(record.imagePath);
  const poster = posterPath || record.posterPath || (video ? record.imagePath.replace(/\.\w+$/, ".jpg") : undefined);

  // Intersection Observer for lazy loading
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleClick = () => {
    if (onImageClick) onImageClick(record);
    else setShowLightbox(true);
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(record.imagePath);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = record.imagePath.split("/").pop() || (video ? "video.mp4" : "image.png");
      a.click();
      URL.revokeObjectURL(url);
    } catch { alert("下载失败"); }
  };

  const handleCopyPrompt = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const text = record.prompt || record.keywordNames;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
  };

  return (
    <>
      <div
        ref={cardRef}
        className="break-inside-avoid mb-4 overflow-hidden transition-all duration-300 group relative rounded-xl"
        style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "var(--border-hover)";
          e.currentTarget.style.boxShadow = "0 4px 24px rgba(0,0,0,0.25)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "var(--border)";
          e.currentTarget.style.boxShadow = "none";
        }}
      >
        {/* Image area */}
        <div className="relative cursor-pointer overflow-hidden" onClick={handleClick}>
          {/* Skeleton placeholder */}
          {!loaded && !imageFailed && inView && (
            <div className="w-full bg-[var(--skeleton)] animate-pulse" style={{ aspectRatio: "1/1", minHeight: "160px" }} />
          )}

          {inView && !imageFailed && (
            <img
              src={video ? poster : record.imagePath}
              alt={record.prompt || record.keywordNames}
              className="w-full h-auto block transition-opacity duration-500"
              style={{ opacity: loaded ? 1 : 0 }}
              onLoad={() => setLoaded(true)}
              onError={() => setImageFailed(true)}
            />
          )}

          {inView && imageFailed && (
            <div
              className="w-full min-h-[160px] flex flex-col items-center justify-center p-4 text-xs text-center gap-1"
              style={{ background: "var(--bg-tertiary)", color: "var(--text-muted)", aspectRatio: "1/1" }}
            >
              <span className="text-base opacity-50">🖼️</span>
              <span>图片加载失败</span>
            </div>
          )}

          {!inView && (
            <div className="w-full bg-[var(--skeleton)]" style={{ aspectRatio: "1/1", minHeight: "160px" }} />
          )}

          {/* Video play overlay */}
          {video && loaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-t-xl">
              <div className="w-10 h-10 rounded-full bg-white/25 backdrop-blur flex items-center justify-center transition-transform group-hover:scale-110">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>
              </div>
            </div>
          )}


          {/* Hover actions */}
          <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/70 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-end justify-between gap-2">
            <p className="text-[11px] text-white/90 line-clamp-2 leading-tight flex-1">
              {record.prompt || record.keywordNames}
            </p>
            <div className="flex gap-1 shrink-0">
              <button
                onClick={handleCopyPrompt}
                className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/35 text-white flex items-center justify-center text-xs transition-colors"
                title="复制提示词"
              >
                📋
              </button>
              <button
                onClick={handleDownload}
                className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/35 text-white flex items-center justify-center text-xs transition-colors"
                title="下载"
              >
                ⬇
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(record.id); }}
                className="w-7 h-7 rounded-full bg-white/20 hover:bg-red-500/80 text-white flex items-center justify-center text-xs transition-colors"
                title="删除"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      </div>

      {showLightbox && (
        <Lightbox
          src={record.imagePath}
          alt={record.prompt}
          keywords={record.keywordNames}
          onClose={() => setShowLightbox(false)}
          onDelete={() => onDelete(record.id)}
        />
      )}
    </>
  );
}

