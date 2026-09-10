"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ImageRecord } from "@/types";

interface Props {
  records: ImageRecord[];
  activeIndex: number;
  onClose: () => void;
  onDelete: (record: ImageRecord) => void;
}

export default function FullscreenViewer({
  records,
  activeIndex,
  onClose,
  onDelete,
}: Props) {
  const [showDetail, setShowDetail] = useState(false);
  const [copied, setCopied] = useState(false);
  const [index, setIndex] = useState(activeIndex);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => setIndex(activeIndex), [activeIndex]);

  useEffect(() => {
    const container = scrollRef.current;
    if (container) container.scrollLeft = activeIndex * container.clientWidth;
  }, [activeIndex]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const onScroll = () => {
      const next = Math.round(container.scrollLeft / container.clientWidth);
      if (next >= 0 && next < records.length) setIndex(next);
    };
    container.addEventListener("scroll", onScroll, { passive: true });
    return () => container.removeEventListener("scroll", onScroll);
  }, [records.length]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const scrollTo = useCallback((target: number) => {
    const container = scrollRef.current;
    if (!container) return;
    container.scrollTo({
      left: target * container.clientWidth,
      behavior: "smooth",
    });
  }, []);

  const record = records[index];
  if (!record) return null;

  const caption = record.prompt || record.keywordNames;

  const download = () => {
    const link = document.createElement("a");
    link.href = record.imagePath;
    link.download = record.imagePath.split("=").pop() ?? "image.png";
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(caption);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="作品预览"
      className="fixed inset-0 z-50 flex animate-fade-in flex-col bg-black"
    >
      <div
        className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-4 py-3"
        style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="关闭"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white transition-colors hover:bg-white/30"
        >
          ✕
        </button>

        {records.length > 1 && (
          <div className="flex max-w-[50vw] flex-wrap justify-center gap-1.5">
            {records.map((item, i) => (
              <button
                key={item.id}
                type="button"
                aria-label={`第 ${i + 1} 张`}
                onClick={() => scrollTo(i)}
                className="h-1.5 w-1.5 rounded-full transition-base"
                style={{
                  background: i === index ? "#fff" : "rgba(255,255,255,0.35)",
                  transform: i === index ? "scale(1.4)" : "scale(1)",
                }}
              />
            ))}
          </div>
        )}

        <span className="min-w-[44px] text-right text-xs tabular-nums text-white/60">
          {index + 1}/{records.length}
        </span>
      </div>

      <div
        ref={scrollRef}
        className="flex flex-1 snap-x snap-mandatory overflow-x-auto scrollbar-none"
        style={{ scrollSnapType: "x mandatory" }}
      >
        {records.map((item, i) => (
          <div
            key={item.id}
            className="flex h-full w-full flex-none snap-center items-center justify-center"
          >
            <img
              src={item.imagePath}
              alt={item.prompt || item.keywordNames}
              loading={Math.abs(i - index) <= 1 ? "eager" : "lazy"}
              className="max-h-full max-w-full object-contain"
            />
          </div>
        ))}
      </div>

      {records.length > 1 && (
        <>
          <button
            type="button"
            aria-label="上一张"
            onClick={() => scrollTo(Math.max(0, index - 1))}
            disabled={index === 0}
            className="absolute left-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-lg text-white transition-colors hover:bg-white/25 disabled:opacity-20"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="下一张"
            onClick={() => scrollTo(Math.min(records.length - 1, index + 1))}
            disabled={index === records.length - 1}
            className="absolute right-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-lg text-white transition-colors hover:bg-white/25 disabled:opacity-20"
          >
            ›
          </button>
        </>
      )}

      <div
        className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-center gap-3 px-4"
        style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
      >
        <button
          type="button"
          onClick={() => setShowDetail((value) => !value)}
          className="rounded-full bg-white/15 px-4 py-2.5 text-sm text-white backdrop-blur transition-colors hover:bg-white/25"
        >
          {showDetail ? "收起详情" : "详情"}
        </button>
        <button
          type="button"
          onClick={download}
          className="rounded-full bg-white/15 px-4 py-2.5 text-sm text-white backdrop-blur transition-colors hover:bg-white/25"
        >
          下载
        </button>
      </div>

      {showDetail && (
        <>
          <div
            className="absolute inset-0 z-30"
            onClick={() => setShowDetail(false)}
          />
          <div
            className="absolute inset-x-0 bottom-0 z-40 max-h-[55vh] animate-slide-up overflow-y-auto rounded-t-2xl"
            style={{
              background: "var(--bg-secondary)",
              boxShadow: "0 -4px 24px rgba(0,0,0,0.5)",
              paddingBottom: "max(16px, env(safe-area-inset-bottom))",
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-center pb-1 pt-3">
              <div
                className="h-1 w-10 rounded-full"
                style={{ background: "var(--border-hover)" }}
              />
            </div>

            <div className="px-5 pb-6">
              {record.keywordNames && (
                <div className="mb-4">
                  <p
                    className="mb-2 text-xs"
                    style={{ color: "var(--text-muted)" }}
                  >
                    关键词
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {record.keywordNames.split(",").map((keyword, i) => (
                      <span
                        key={i}
                        className="rounded-full px-2.5 py-1 text-xs"
                        style={{
                          background: "var(--accent-light)",
                          color: "var(--accent)",
                        }}
                      >
                        {keyword.trim()}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="mb-4">
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    提示词
                  </p>
                  {record.size && (
                    <span
                      className="text-[10px] tabular-nums"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {record.size}
                    </span>
                  )}
                </div>
                <p
                  className="whitespace-pre-wrap break-words text-sm leading-relaxed"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {caption}
                </p>
              </div>

              <div className="mt-4 flex gap-3">
                <button
                  type="button"
                  onClick={copy}
                  className="flex-1 rounded-lg py-2.5 text-sm font-medium transition-base"
                  style={{
                    background: copied
                      ? "var(--success)"
                      : "var(--bg-tertiary)",
                    color: copied ? "#fff" : "var(--text-secondary)",
                  }}
                >
                  {copied ? "已复制" : "复制提示词"}
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(record)}
                  className="flex-1 rounded-lg py-2.5 text-sm font-medium transition-base"
                  style={{
                    background: "var(--danger-bg)",
                    color: "var(--danger)",
                  }}
                >
                  删除
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
