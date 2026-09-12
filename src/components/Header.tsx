"use client";

import { useTheme } from "./ThemeProvider";
import { useAuth } from "./AuthProvider";
import { useConfirm } from "./ConfirmDialog";

const ACTION_CLASS =
  "flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-base hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]";

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
      className="sticky top-0 z-40 border-b backdrop-blur-xl lg:hidden"
      style={{
        borderColor: "var(--border)",
        background: "var(--bg-elevated, var(--bg-secondary))",
      }}
    >
      <div className="flex items-center justify-between gap-3 px-3 py-2 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <img src="/icon.svg" alt="" className="h-6 w-6 shrink-0" />
          <div className="min-w-0">
            <div
              className="truncate text-[13px] font-semibold leading-tight"
              style={{ color: "var(--text-primary)" }}
            >
              文生图工作室
            </div>
            <div
              className="hidden text-[9px] uppercase leading-tight tracking-[0.2em] sm:block"
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
            className={`${ACTION_CLASS} lg:hidden`}
            style={{
              borderColor: "var(--border)",
              color: "var(--text-secondary)",
            }}
            title="设置"
          >
            <span aria-hidden>⚙️</span>
          </button>
          <button
            type="button"
            onClick={toggle}
            className={ACTION_CLASS}
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
            className={ACTION_CLASS}
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
