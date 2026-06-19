"use client";

import Link from "next/link";
import { useTheme } from "@/components/ThemeProvider";
import { useState, useEffect } from "react";

export default function Header() {
  const { theme, toggle } = useTheme();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className="sticky top-0 z-40 border-b transition-all duration-300"
      style={{
        borderColor: scrolled ? "var(--border)" : "transparent",
        background: scrolled
          ? "var(--bg-elevated)"
          : "transparent",
        backdropFilter: scrolled ? "blur(24px) saturate(1.2)" : "none",
        WebkitBackdropFilter: scrolled ? "blur(24px) saturate(1.2)" : "none",
      }}
    >
      <div className="mx-auto flex max-w-[124rem] items-center justify-between gap-4 px-4 py-3 sm:px-6 xl:px-8">
        <Link href="/" className="group flex items-center gap-3 shrink-0">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-2xl border text-base font-bold transition-all duration-300 group-hover:scale-105 group-hover:shadow-[0_0_20px_var(--accent-glow)]"
            style={{
              background: "var(--accent-light)",
              borderColor: "var(--accent)",
              color: "var(--accent)",
            }}
          >
            AI
          </span>
          <div className="hidden sm:block">
            <div className="text-[10px] uppercase tracking-[0.28em] font-medium" style={{ color: "var(--text-muted)" }}>
              Text to Image Studio
            </div>
            <div className="text-base font-semibold tracking-[0.02em]" style={{ color: "var(--text-primary)" }}>
              文生图工作室
            </div>
          </div>
        </Link>

        <nav className="flex items-center gap-1.5 sm:gap-2">
          <Link href="/" className="rounded-full border px-3.5 py-1.5 text-xs sm:text-sm font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)", background: "transparent" }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--border-hover)"; e.currentTarget.style.color = "var(--text-primary)"; e.currentTarget.style.background = "var(--bg-tertiary)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-secondary)"; e.currentTarget.style.background = "transparent"; }}
          >
            创作台
          </Link>
          <a href="/admin.html" className="rounded-full border px-3.5 py-1.5 text-xs sm:text-sm font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)", background: "transparent" }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--border-hover)"; e.currentTarget.style.color = "var(--text-primary)"; e.currentTarget.style.background = "var(--bg-tertiary)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-secondary)"; e.currentTarget.style.background = "transparent"; }}
          >
            后台配置
          </a>
          <button onClick={toggle} className="ml-1 rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] flex items-center gap-1.5"
            style={{ background: "var(--bg-secondary)", borderColor: "var(--border)", color: "var(--text-secondary)" }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--border-hover)"; e.currentTarget.style.color = "var(--text-primary)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
            title={theme === "dark" ? "切换明亮模式" : "切换暗黑模式"}
          >
            <span className="text-sm leading-none">{theme === "dark" ? "☀️" : "🌙"}</span>
            <span className="hidden sm:inline">{theme === "dark" ? "浅色" : "深色"}</span>
          </button>
        </nav>
      </div>
    </header>
  );
}
