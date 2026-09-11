"use client";

import { useState } from "react";
import type { ImageRecord } from "@/types";
import { useToast } from "./Toast";

interface Props {
  record: ImageRecord;
  onDelete: (record: ImageRecord) => void;
  onOpen: (record: ImageRecord) => void;
}

/**
 * 卡片始终保留骨架层，图片绝对定位盖在上面。
 *
 * 注意：不要用 display:none 隐藏未加载的 <img>——配合 loading="lazy"，
 * 浏览器会认为它不在渲染树里而永远不去加载，onLoad 也就永远不会触发，
 * 结果是骨架屏一直转下去。这里改成「占位层 + 绝对定位图片」。
 */
export default function ImageCard({ record, onDelete, onOpen }: Props) {
  const toast = useToast();
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const caption = record.prompt || record.keywordNames;
  const filename = record.imagePath.split("/").pop()?.split("?")[0] || "image";

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
        className="relative block aspect-square w-full cursor-pointer overflow-hidden"
        aria-label={`查看：${caption || "作品"}`}
      >
        {!loaded && <div className="animate-skeleton absolute inset-0" />}
        {!failed && (
          <img
            src={record.imagePath}
            alt={caption}
            loading="lazy"
            decoding="async"
            className="img-loaded absolute inset-0 h-full w-full object-cover"
            style={{ opacity: loaded ? 1 : 0 }}
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
          />
        )}
        {failed && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-xs"
            style={{
              background: "var(--bg-tertiary)",
              color: "var(--text-muted)",
            }}
          >
            <span className="text-lg opacity-50" aria-hidden>
              🖼️
            </span>
            <span>图片加载失败</span>
          </div>
        )}

        {/* 常驻的底部渐隐信息条：移动端没有 hover，直接显示 */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/85 via-black/45 to-transparent p-3 opacity-100 transition-opacity lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100">
          <p className="line-clamp-2 flex-1 text-left text-[11px] leading-tight text-white/90">
            {caption}
          </p>
          <div className="pointer-events-auto flex shrink-0 gap-1">
            {[
              { label: "复制提示词", icon: "📋", onClick: copyPrompt },
              { label: "下载原图", icon: "⬇", onClick: download },
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
                className={`flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-xs text-white backdrop-blur-sm transition-colors ${
                  action.danger ? "hover:bg-red-500/80" : "hover:bg-white/35"
                }`}
              >
                {action.icon}
              </button>
            ))}
          </div>
        </div>
      </button>
    </article>
  );
}
