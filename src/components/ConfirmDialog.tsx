"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

interface ConfirmRequest {
  title: string;
  message?: string;
  confirmLabel?: string;
  danger?: boolean;
}

type ConfirmFn = (request: ConfirmRequest | string) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

interface Pending extends ConfirmRequest {
  resolve: (value: boolean) => void;
}

/**
 * 替代原生 window.confirm：原生弹窗会阻塞、样式不可控，
 * 且在移动端 WebView 下表现不一致。
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const pendingRef = useRef<Pending | null>(null);

  const confirm = useCallback<ConfirmFn>((request) => {
    const normalised: ConfirmRequest =
      typeof request === "string" ? { title: request } : request;
    // 新请求顶掉旧请求，旧的一律按取消处理，避免 promise 永久悬挂
    pendingRef.current?.resolve(false);
    return new Promise<boolean>((resolve) => {
      const next = { ...normalised, resolve };
      pendingRef.current = next;
      setPending(next);
    });
  }, []);

  const settle = useCallback((value: boolean) => {
    const current = pendingRef.current;
    pendingRef.current = null;
    setPending(null);
    current?.resolve(value);
  }, []);

  useEffect(() => {
    if (!pending) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") settle(false);
      if (e.key === "Enter") settle(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending, settle]);

  const value = useMemo(() => confirm, [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {pending && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={pending.title}
          className="fixed inset-0 z-[110] flex items-center justify-center px-4"
          onClick={() => settle(false)}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-sm rounded-2xl border p-5 animate-fade-in"
            style={{
              borderColor: "var(--border)",
              background: "var(--bg-elevated, var(--bg-secondary))",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              className="text-base font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              {pending.title}
            </h2>
            {pending.message && (
              <p
                className="mt-2 text-sm leading-relaxed"
                style={{ color: "var(--text-secondary)" }}
              >
                {pending.message}
              </p>
            )}
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => settle(false)}
                className="flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-base"
                style={{
                  borderColor: "var(--border)",
                  color: "var(--text-secondary)",
                  background: "var(--bg-tertiary)",
                }}
              >
                取消
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => settle(true)}
                className="flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-base"
                style={{
                  background: pending.danger
                    ? "var(--danger)"
                    : "var(--accent)",
                }}
              >
                {pending.confirmLabel ?? "确定"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm 必须在 <ConfirmProvider> 内使用");
  return ctx;
}
