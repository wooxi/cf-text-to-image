"use client";

import { useState } from "react";
import { useAuth } from "./AuthProvider";
import { useToast } from "./Toast";
import { ApiError } from "@/lib/api";

/**
 * 单用户访问密码门。没有注册、没有账号管理——
 * 服务是私人用的，密码由 Cloudflare 环境变量提供。
 */
export default function Gate() {
  const { login, passwordConfigured } = useAuth();
  const toast = useToast();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!password) {
      setError("请输入访问密码");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await login(password);
      setPassword("");
      toast.success("已解锁");
    } catch (e) {
      const message = e instanceof ApiError ? e.message : "登录失败";
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.5]"
        style={{
          background:
            "radial-gradient(circle at 20% 10%, var(--accent-light) 0%, transparent 45%), radial-gradient(circle at 85% 90%, rgba(136,192,168,0.10) 0%, transparent 45%)",
        }}
      />
      <div className="relative w-full max-w-sm">
        <div className="mb-6 text-center">
          <div
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border"
            style={{
              borderColor: "var(--border)",
              background: "var(--bg-secondary)",
            }}
          >
            <img src="/icon.svg" alt="" className="h-8 w-8" />
          </div>
          <h1
            className="text-xl font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            文生图<span style={{ color: "var(--accent)" }}>工作室</span>
          </h1>
          <p className="mt-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
            私人工作台 · 请输入访问密码
          </p>
        </div>

        <form
          onSubmit={submit}
          className="space-y-4 rounded-2xl border p-6"
          style={{
            borderColor: "var(--border)",
            background: "var(--bg-secondary)",
          }}
        >
          {!passwordConfigured && (
            <div
              className="rounded-lg border px-3 py-2.5 text-xs leading-relaxed"
              style={{
                borderColor: "var(--danger)",
                background: "var(--danger-bg)",
                color: "var(--danger)",
              }}
            >
              服务端尚未配置访问密码。请在 Cloudflare 控制台为 Pages 项目设置
              <code className="mx-1 font-mono">ACCESS_PASSWORD</code>
              环境变量后重试。
            </div>
          )}

          <div>
            <label
              htmlFor="gate-password"
              className="mb-1.5 block text-xs font-medium"
              style={{ color: "var(--text-muted)" }}
            >
              访问密码
            </label>
            <input
              id="gate-password"
              type="password"
              value={password}
              autoFocus
              autoComplete="current-password"
              onChange={(e) => {
                setPassword(e.target.value);
                setError("");
              }}
              className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-base focus:border-[var(--accent)]"
              style={{
                borderColor: error ? "var(--danger)" : "var(--border)",
                background: "var(--bg-tertiary)",
                color: "var(--text-primary)",
              }}
              placeholder="••••••••"
            />
            {error && (
              <p className="mt-2 text-xs" style={{ color: "var(--danger)" }}>
                {error}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg py-2.5 text-sm font-semibold text-white transition-base disabled:opacity-50"
            style={{ background: "var(--accent)" }}
          >
            {busy ? "验证中…" : "进入"}
          </button>
        </form>

        <p
          className="mt-4 text-center text-[11px] leading-relaxed"
          style={{ color: "var(--text-muted)" }}
        >
          模型接口、图床、系统提示词都在登录后的「设置」里改，
          <br />
          入口密码来自 Cloudflare 环境变量。
        </p>
      </div>
    </div>
  );
}
