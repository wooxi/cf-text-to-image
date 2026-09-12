"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "./Toast";

interface Props {
  images: string[];
  onChange: (images: string[]) => void;
  maxImages?: number;
}

const MAX_FILE_MB = 5;
const ACCEPTED = /^image\/(png|jpeg|webp|gif|avif)$/;

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("读取文件失败"));
    reader.readAsDataURL(file);
  });
}

export default function ImageUploader({
  images,
  onChange,
  maxImages = 3,
}: Props) {
  const toast = useToast();
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  /**
   * 一次性把整批图片并入 state。
   * 旧实现让每个文件的 onload 各自调用 onChange([...images, image])，
   * 每次读到的都是同一份旧数组，所以拖入 3 张只会留下最后一张。
   */
  const addAll = useCallback(
    (incoming: string[]) => {
      const room = Math.max(0, maxImages - images.length);
      if (incoming.length > room) {
        toast.error(`最多 ${maxImages} 张参考图，已忽略多余的部分`);
      }
      if (room > 0) onChange([...images, ...incoming.slice(0, room)]);
    },
    [images, maxImages, onChange, toast],
  );

  const handleFiles = useCallback(
    async (files: FileList | File[] | null) => {
      const list = Array.from(files ?? []).filter((file) =>
        file.type.startsWith("image/"),
      );
      if (!list.length) return;

      const invalid = list.find((file) => !ACCEPTED.test(file.type));
      if (invalid) {
        toast.error("仅支持 PNG / JPEG / WebP / GIF / AVIF");
        return;
      }
      const oversized = list.find(
        (file) => file.size > MAX_FILE_MB * 1024 * 1024,
      );
      if (oversized) {
        toast.error(`单张图片不能超过 ${MAX_FILE_MB}MB`);
        return;
      }

      setBusy(true);
      try {
        addAll(await Promise.all(list.map(readFile)));
      } catch {
        toast.error("图片读取失败");
      } finally {
        setBusy(false);
      }
    },
    [addAll, toast],
  );

  // 支持直接 Ctrl/⌘+V 粘贴截图
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const files = Array.from(event.clipboardData?.files ?? []);
      if (!files.length) return;
      event.preventDefault();
      void handleFiles(files);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [handleFiles]);

  return (
    <div className="space-y-3">
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((image, index) => (
            <div key={index} className="group relative">
              <img
                src={image}
                alt={`参考图 ${index + 1}`}
                className="h-24 w-24 rounded-lg border object-cover"
                style={{ borderColor: "var(--border)" }}
              />
              <button
                type="button"
                aria-label={`移除参考图 ${index + 1}`}
                onClick={() => onChange(images.filter((_, i) => i !== index))}
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <div
        role="button"
        tabIndex={0}
        onClick={() => !busy && fileRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            fileRef.current?.click();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void handleFiles(event.dataTransfer.files);
        }}
        className="cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition-base"
        style={{
          borderColor: dragging ? "var(--accent)" : "var(--border)",
          background: dragging ? "var(--accent-light)" : "transparent",
          opacity: busy ? 0.6 : 1,
        }}
      >
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          {busy ? "读取中…" : "点击选择、拖拽到此处，或直接 Ctrl/⌘+V 粘贴"}
        </p>
        <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
          单张不超过 {MAX_FILE_MB}MB，最多 {maxImages} 张
        </p>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
        multiple
        className="hidden"
        onChange={(event) => {
          void handleFiles(event.target.files);
          event.target.value = "";
        }}
      />
    </div>
  );
}
