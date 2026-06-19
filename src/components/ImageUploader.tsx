"use client";

import { useState, useRef } from "react";

interface Props {
  images: string[];
  onChange: (images: string[]) => void;
  allowUpload?: boolean;
  allowDataUri?: boolean;
  hint?: string;
}

export default function ImageUploader({ images, onChange, allowUpload = true, allowDataUri = true, hint = "支持多张 JPG、PNG、WebP" }: Props) {
  const [dragging, setDragging] = useState(false);
  const [url, setUrl] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const addImage = (image: string) => onChange([...images, image]);
  const removeImage = (image: string) => onChange(images.filter((item) => item !== image));

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) { alert("请选择图片文件"); return; }
    const reader = new FileReader();
    reader.onload = () => addImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach(handleFile);
  };

  const addUrl = () => {
    const value = url.trim();
    if (!value) return;
    if (!/^https?:\/\//i.test(value) && (!allowDataUri || !value.startsWith("data:image/"))) {
      alert(allowDataUri ? "请输入公网图片 URL 或 Data URI" : "请输入公网图片 URL");
      return;
    }
    addImage(value);
    setUrl("");
  };

  return (
    <div className="space-y-3">
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((image) => (
            <div key={image} className="relative inline-block group">
              <img src={image} className="w-24 h-24 object-cover rounded-lg border border-[var(--border)]" alt="参考图" />
              <button
                onClick={() => removeImage(image)}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {allowUpload && (
        <div
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition ${
            dragging ? "border-[var(--accent)] bg-[var(--accent-light)]" : "border-[var(--border)]"
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
          onClick={() => fileRef.current?.click()}
        >
          <p className="text-sm text-[var(--text-muted)]">拖拽图片到此处，或点击上传</p>
          <p className="text-xs text-[var(--text-muted)] mt-1 opacity-60">{hint}</p>
        </div>
      )}

      <div className="flex gap-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="flex-1 px-3 py-2 bg-app-bg border border-app-border rounded-lg text-sm text-app-text focus:outline-none"
          placeholder={allowDataUri ? "粘贴公网图片 URL 或 Data URI" : "粘贴公网图片 URL"}
        />
        <button
          type="button"
          onClick={addUrl}
          className="px-3 py-2 rounded-lg text-sm text-white"
          style={{ background: "var(--accent)" }}
        >
          添加
        </button>
      </div>

      {allowUpload && <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />}
    </div>
  );
}
