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

const DURATION_MS: Record<ToastKind, number> = { error: 5000, success: 3000, info: 3000 };

const KIND_STYLE: Record<ToastKind, { icon: string; border: string; color: string; bg: string }> = {
  error: { icon: "✕", border: "var(--danger)", color: "var(--danger)", bg: "var(--bg-elevated, var(--bg-secondary))" },
  success: { icon: "✓", border: "var(--success)", color: "var(--success)", bg: "var(--bg-elevated, var(--bg-secondary))" },
  info: { icon: "ℹ", border: "var(--accent)", color: "var(--accent)", bg: "var(--bg-elevated, var(--bg-secondary))" },
};

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast 必须在 <ToastProvider> 内使用");
  return ctx;
}

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
      <div className="pointer-events-none fixed top-4 left-1/2 z-[100] flex w-full max-w-sm -translate-x-1/2 flex-col items-center gap-2 px-4">
        {items.map((t) => {
          const style = KIND_STYLE[t.kind];
          return (
            <div
              key={t.id}
              className="pointer-events-auto flex w-full items-start gap-2.5 rounded-xl border px-4 py-3 shadow-lg backdrop-blur-xl toast-slide-in"
              style={{ borderColor: style.border, background: style.bg }}
              role="alert"
            >
              <span
                className="mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                style={{ background: style.color, width: 18, height: 18 }}
              >
                {style.icon}
              </span>
              <p className="flex-1 text-sm leading-relaxed break-words" style={{ color: "var(--text-primary)" }}>
                {t.message}
              </p>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
