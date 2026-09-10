"use client";

import { useState } from "react";
import type { ImageRecord } from "@/types";
import { useToast } from "./Toast";

interface Props {
  record: ImageRecord;
  onDelete: (record: ImageRecord) => void;
  onOpen: (record: ImageRecord) => void;
}

export default function ImageCard({ record, onDelete, onOpen }: Props) {
  const toast = useToast();
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const caption = record.prompt || record.keywordNames;
  const filename = record.imagePath.split("=").pop() ?? "image.png";

  const download = (event: React.MouseEvent) => {
    event.stopPropagation();
    const link = document.createElement("a");
    link.href = record.imagePath;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const copyPrompt = async (event: React.MouseEvent) => {
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(caption);
      toast.success("提示词已复制");
    } catch {
      toast.error("复制失败，请手动选择文本");
    }
  };

  return (
    <article
      className="group relative overflow-hidden rounded-xl"
      style={{
        border: `1px solid ${failed ? "var(--danger)" : "var(--border)"}`,
        background: "var(--bg-secondary)",
      }}
    >
      <button
        type="button"
        onClick={() => onOpen(record)}
        className="block w-full cursor-pointer"
        aria-label={`查看：${caption || "作品"}`}
      >
        {!loaded && !failed && (
          <div className="animate-skeleton" style={{ aspectRatio: "3 / 4" }} />
        )}
        {!failed && (
          <img
            src={record.imagePath}
            alt={caption}
            loading="lazy"
            decoding="async"
            className="block h-auto w-full"
            style={loaded ? undefined : { display: "none" }}
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
          />
        )}
        {failed && (
          <div
            className="flex flex-col items-center justify-center gap-1 text-xs"
            style={{
              aspectRatio: "3 / 4",
              background: "var(--bg-tertiary)",
              color: "var(--text-muted)",
            }}
          >
            <span className="text-base opacity-50" aria-hidden>
              🖼️
            </span>
            <span>图片加载失败</span>
          </div>
        )}
      </button>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        <p className="pointer-events-auto line-clamp-2 flex-1 text-[11px] leading-tight text-white/90">
          {caption}
        </p>
        <div className="pointer-events-auto flex shrink-0 gap-1">
          {[
            { label: "复制提示词", icon: "📋", onClick: copyPrompt },
            { label: "下载", icon: "⬇", onClick: download },
            {
              label: "删除",
              icon: "✕",
              onClick: (event: React.MouseEvent) => {
                event.stopPropagation();
                onDelete(record);
              },
              danger: true,
            },
          ].map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={action.onClick}
              title={action.label}
              aria-label={action.label}
              className={`flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-xs text-white transition-colors ${
                action.danger ? "hover:bg-red-500/80" : "hover:bg-white/35"
              }`}
            >
              {action.icon}
            </button>
          ))}
        </div>
      </div>
    </article>
  );
}
