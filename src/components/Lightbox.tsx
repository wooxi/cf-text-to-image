"use client";

import { useState, useEffect, useCallback } from "react";

interface Props {
  src: string;
  alt: string;
  keywords: string;
  onClose: () => void;
  onDelete?: () => void;
}

export default function Lightbox({ src, alt, keywords, onClose, onDelete }: Props) {
  const [copied, setCopied] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const isVideoFile = /\.(mp4|webm|mov)$/i.test(src);

  // Close on Escape
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [handleKeyDown]);

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(alt);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = alt;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
    }
  };

  const handleCopyKeywords = async () => {
    try {
      await navigator.clipboard.writeText(keywords);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = keywords;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = async () => {
    try {
      const res = await fetch(src);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = src.split("/").pop() || "image.png";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Fallback: open in new tab
      window.open(src, "_blank");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in"
      style={{ background: "rgba(0,0,0,0.88)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      {/* Close button - top right */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center text-sm transition-all"
        style={{ backdropFilter: "blur(8px)" }}
        aria-label="关闭"
      >
        ✕
      </button>

      <div
        className="flex flex-col md:flex-row gap-0 max-w-[95vw] max-h-[90vh] rounded-2xl overflow-hidden shadow-2xl animate-scale-in"
        style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Media area */}
        <div className="flex-shrink-0 flex items-center justify-center bg-black/40 md:max-w-[60vw] max-h-[45vh] md:max-h-[90vh] relative">
          {!imageLoaded && !isVideoFile && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: "var(--border)", borderTopColor: "var(--accent)" }} />
            </div>
          )}
          {isVideoFile ? (
            <video src={src} controls autoPlay className="max-w-full max-h-[45vh] md:max-h-[90vh] rounded-lg" />
          ) : (
            <img
              src={src}
              alt={alt}
              className="max-w-full max-h-[45vh] md:max-h-[90vh] object-contain transition-opacity duration-500"
              style={{ opacity: imageLoaded ? 1 : 0 }}
              onLoad={() => setImageLoaded(true)}
            />
          )}
        </div>

        {/* Info panel */}
        <div className="flex flex-col p-5 md:w-80 lg:w-96 overflow-auto max-h-[45vh] md:max-h-[90vh]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                {isVideoFile ? "🎬 视频详情" : "🖼️ 图片详情"}
              </h3>
            </div>
          </div>

          {/* Keywords */}
          {keywords && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>关键词</p>
                <button
                  onClick={handleCopyKeywords}
                  className="text-xs transition-colors"
                  style={{ color: copied ? "var(--success)" : "var(--accent)" }}
                >
                  {copied ? "✓ 已复制" : "复制"}
                </button>
              </div>
              <div className="flex flex-wrap gap-1">
                {keywords.split(", ").map((kw) => (
                  <span
                    key={kw}
                    className="px-2 py-0.5 rounded-md text-xs font-medium"
                    style={{ background: "var(--accent-light)", color: "var(--accent)" }}
                  >
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Prompt */}
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>提示词</p>
              <button
                onClick={handleCopyPrompt}
                className="text-xs transition-colors"
                style={{ color: copiedPrompt ? "var(--success)" : "var(--accent)" }}
              >
                {copiedPrompt ? "✓ 已复制" : "复制"}
              </button>
            </div>
            <div
              className="text-sm leading-relaxed whitespace-pre-wrap break-all rounded-lg p-3 max-h-48 overflow-y-auto scrollbar-thin"
              style={{ background: "var(--bg-tertiary)", color: "var(--text-secondary)" }}
            >
              {alt}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 mt-4 pt-4 border-t" style={{ borderColor: "var(--border)" }}>
            <button
              onClick={handleDownload}
              className="flex-1 py-2.5 text-xs font-medium rounded-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{ background: "var(--accent)", color: "#fff" }}
            >
              {isVideoFile ? "下载视频" : "下载图片"}
            </button>
            {onDelete && (
              <button
                onClick={() => { onDelete(); onClose(); }}
                className="flex-1 py-2.5 text-xs font-medium rounded-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{ background: "var(--danger-bg)", color: "var(--danger)" }}
              >
                删除
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
