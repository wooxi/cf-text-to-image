"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

type ToastKind = "error" | "success" | "info";

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastApi {
  error: (message: string) => void;
  success: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const DURATION_MS: Record<ToastKind, number> = {
  error: 5000,
  success: 2600,
  info: 3000,
};

const KIND_STYLE: Record<
  ToastKind,
  { icon: string; color: string; tint: string }
> = {
  error: { icon: "✕", color: "var(--danger)", tint: "var(--danger-bg)" },
  success: { icon: "✓", color: "var(--success)", tint: "var(--success-bg)" },
  info: { icon: "ℹ", color: "var(--accent)", tint: "var(--accent-light)" },
};

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast 必须在 <ToastProvider> 内使用");
  return ctx;
}

/**
 * 提示条固定在右上角，避开顶部标题栏和主操作区；
 * 底色用低饱和的着色而不是实心色块，避免像「已解锁」这种提示盖住界面。
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = nextId.current++;
    setItems((prev) => [...prev.slice(-3), { id, kind, message }]);
    setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, DURATION_MS[kind]);
  }, []);

  const api = useRef<ToastApi>({
    error: (m) => push("error", m),
    success: (m) => push("success", m),
    info: (m) => push("info", m),
  }).current;

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed right-3 top-3 z-[100] flex w-[min(20rem,calc(100vw-1.5rem))] flex-col items-end gap-2">
        {items.map((t) => {
          const style = KIND_STYLE[t.kind];
          return (
            <div
              key={t.id}
              className="glass-panel pointer-events-auto flex w-full items-start gap-2.5 rounded-lg px-3 py-2.5 shadow-xl toast-slide-in"
              style={{ borderColor: "var(--border-hover)" }}
              role="alert"
            >
              <span
                className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                style={{ background: style.tint, color: style.color }}
              >
                {style.icon}
              </span>
              <p
                className="flex-1 break-words text-xs leading-relaxed"
                style={{ color: "var(--text-primary)" }}
              >
                {t.message}
              </p>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
