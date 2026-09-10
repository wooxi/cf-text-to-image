"use client";

import { useTheme } from "./ThemeProvider";
import { useAuth } from "./AuthProvider";
import { useConfirm } from "./ConfirmDialog";

export default function Header({
  onOpenSettings,
}: {
  onOpenSettings: () => void;
}) {
  const { theme, toggle } = useTheme();
  const { logout } = useAuth();
  const confirm = useConfirm();

  return (
    <header
      className="sticky top-0 z-40 border-b backdrop-blur-xl"
      style={{
        borderColor: "var(--border)",
        background: "var(--bg-elevated, var(--bg-secondary))",
      }}
    >
      <div className="flex items-center justify-between gap-3 px-3 py-2 sm:px-5 sm:py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <img src="/icon.svg" alt="" className="h-7 w-7 shrink-0" />
          <div className="min-w-0">
            <div
              className="truncate text-sm font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              文生图工作室
            </div>
            <div
              className="hidden text-[10px] uppercase tracking-[0.22em] sm:block"
              style={{ color: "var(--text-muted)" }}
            >
              Text to Image Studio
            </div>
          </div>
        </div>

        <nav className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={onOpenSettings}
            className="rounded-full border px-3 py-1.5 text-xs font-medium transition-base hover:border-[var(--border-hover)]"
            style={{
              borderColor: "var(--border)",
              color: "var(--text-secondary)",
            }}
            title="设置"
          >
            <span aria-hidden>⚙️</span>
            <span className="ml-1 hidden sm:inline">设置</span>
          </button>
          <button
            type="button"
            onClick={toggle}
            className="rounded-full border px-3 py-1.5 text-xs font-medium transition-base hover:border-[var(--border-hover)]"
            style={{
              borderColor: "var(--border)",
              color: "var(--text-secondary)",
            }}
            title={theme === "dark" ? "切换浅色" : "切换深色"}
          >
            <span aria-hidden>{theme === "dark" ? "☀️" : "🌙"}</span>
          </button>
          <button
            type="button"
            onClick={async () => {
              if (
                await confirm({
                  title: "退出登录？",
                  message: "需要重新输入访问密码才能继续使用。",
                  confirmLabel: "退出",
                  danger: true,
                })
              ) {
                await logout();
              }
            }}
            className="rounded-full border px-3 py-1.5 text-xs font-medium transition-base hover:border-[var(--danger)] hover:text-[var(--danger)]"
            style={{
              borderColor: "var(--border)",
              color: "var(--text-secondary)",
            }}
          >
            退出
          </button>
        </nav>
      </div>
    </header>
  );
}
