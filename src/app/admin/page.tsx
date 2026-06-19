"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface ConfigMap { [key: string]: string; }

const CONFIG_LABELS: Record<string, string> = {
  llm_endpoint: "LLM 端点", llm_model: "LLM 模型",
  image_endpoint: "图像端点", image_model: "图像模型",
  video_endpoint: "视频端点", video_model: "视频模型",
};

const KEY_LABELS: Record<string, string> = {
  llm_api_key: "LLM API Key", image_api_key: "图像 API Key", video_api_key: "视频 API Key",
};

const MODEL_TO_ENDPOINT: Record<string, string> = {
  llm_model: "llm_endpoint", image_model: "image_endpoint", video_model: "video_endpoint",
};

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ username: string } | null>(null);
  const [config, setConfig] = useState<ConfigMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [fetchingModel, setFetchingModel] = useState<string | null>(null);
  const [modelLists, setModelLists] = useState<Record<string, string[]>>({});
  const [modelDropdown, setModelDropdown] = useState<string | null>(null);

  useEffect(() => { checkAuth(); }, []);

  async function checkAuth() {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) { const d = await res.json(); setUser(d.data); loadConfig(); }
      else setLoading(false);
    } catch { setLoading(false); }
  }

  async function loadConfig() {
    try {
      const res = await fetch("/api/config");
      if (res.ok) setConfig((await res.json()).data || {});
    } catch {}
    setLoading(false);
  }

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: fd.get("username"), password: fd.get("password") }),
      });
      if (res.ok) { const d = await res.json(); setUser(d.data); await loadConfig(); }
      else setMessage((await res.json()).error || "登录失败");
    } catch { setMessage("网络错误"); }
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true); setMessage("");
    const fd = new FormData(e.currentTarget);
    const updates: Record<string, string> = {};
    for (const [k, v] of fd.entries()) {
      if (typeof v === "string" && v.trim()) updates[k] = v.trim();
    }
    try {
      const res = await fetch("/api/config", {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updates),
      });
      if (res.ok) { setMessage("保存成功"); await loadConfig(); }
      else setMessage((await res.json()).error || "保存失败");
    } catch { setMessage("网络错误"); }
    setSaving(false);
  }

  async function fetchModels(modelKey: string) {
    const epKey = MODEL_TO_ENDPOINT[modelKey];
    const input = document.querySelector(`input[name="${epKey}"]`) as HTMLInputElement;
    const endpoint = input?.value?.trim();
    if (!endpoint) { setMessage("请先填写端点地址"); return; }
    setFetchingModel(modelKey); setMessage("");
    try {
      const res = await fetch("/api/models", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint }) });
      const d = await res.json();
      if (d.success) { setModelLists(p => ({ ...p, [modelKey]: d.data })); setModelDropdown(modelKey); setMessage(`找到 ${d.data.length} 个模型`); }
      else setMessage(d.error || "获取失败");
    } catch { setMessage("网络错误"); }
    setFetchingModel(null);
  }

  function selectModel(modelKey: string, name: string) {
    const input = document.querySelector(`input[name="${modelKey}"]`) as HTMLInputElement;
    if (input) {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(input, name);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
    setModelDropdown(null);
  }

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: "var(--border)", borderTopColor: "var(--accent)" }} /></div>;

  if (!user) return (
    <div className="max-w-md mx-auto px-4 py-16">
      <h1 className="text-2xl font-bold mb-8 text-center" style={{ color: "var(--text-primary)" }}>后台管理</h1>
      <form onSubmit={handleLogin} className="rounded-2xl border p-6" style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
        <div className="mb-4"><label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>用户名</label><input name="username" type="text" required className="w-full rounded-lg border px-3 py-2.5 text-sm" style={{ borderColor: "var(--border)", background: "var(--bg-tertiary)", color: "var(--text-primary)" }} placeholder="admin" /></div>
        <div className="mb-6"><label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>密码</label><input name="password" type="password" required className="w-full rounded-lg border px-3 py-2.5 text-sm" style={{ borderColor: "var(--border)", background: "var(--bg-tertiary)", color: "var(--text-primary)" }} placeholder="••••••" /></div>
        {message && <p className="text-sm mb-4 text-center" style={{ color: "var(--danger)" }}>{message}</p>}
        <button type="submit" className="w-full rounded-lg py-2.5 text-sm font-medium text-white transition-all" style={{ background: "var(--accent)" }}>登录</button>
      </form>
    </div>
  );

  const modelFields = ["llm_model", "image_model", "video_model"];

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div><h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>后台管理</h1><p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>已登录：{user.username}</p></div>
        <button onClick={() => router.push("/")} className="rounded-full border px-4 py-2 text-sm font-medium transition-all" style={{ borderColor: "var(--border)", color: "var(--text-secondary)", background: "var(--bg-secondary)" }}>← 返回创作台</button>
      </div>

      {/* Endpoint + Model */}
      <form onSubmit={handleSave} className="rounded-2xl border p-6 mb-6" style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
        <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--text-primary)" }}>端点与模型</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {Object.entries(CONFIG_LABELS).map(([key, label]) => {
            const isModel = modelFields.includes(key);
            return (
              <div key={key}>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>{label}</label>
                <div className="flex gap-1.5">
                  <input name={key} type="text" defaultValue={config[key] || ""} className="flex-1 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--border)", background: "var(--bg-tertiary)", color: "var(--text-primary)" }} placeholder={isModel ? "gpt-4o" : "https://..."} />
                  {isModel && (
                    <button type="button" onClick={() => fetchModels(key)} disabled={fetchingModel === key} className="shrink-0 rounded-lg border px-2.5 py-2 text-xs font-medium transition-all disabled:opacity-50" style={{ borderColor: "var(--accent)", color: "var(--accent)", background: "var(--accent-light)" }}>
                      {fetchingModel === key ? "..." : "获取"}
                    </button>
                  )}
                </div>
                {modelDropdown === key && modelLists[key]?.length > 0 && (
                  <div className="mt-1.5 rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)", background: "var(--bg-tertiary)" }}>
                    <div className="max-h-48 overflow-y-auto">
                      {modelLists[key].map(m => <button key={m} type="button" onClick={() => selectModel(key, m)} className="w-full text-left px-3 py-1.5 text-xs hover:bg-[var(--accent-light)] block" style={{ color: "var(--text-secondary)" }}>{m}</button>)}
                    </div>
                    <div className="border-t px-2 py-1" style={{ borderColor: "var(--border)" }}><button type="button" onClick={() => setModelDropdown(null)} className="text-[10px]" style={{ color: "var(--text-muted)" }}>关闭列表</button></div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-6"><button type="submit" disabled={saving} className="rounded-lg px-6 py-2.5 text-sm font-medium text-white transition-all disabled:opacity-50" style={{ background: "var(--accent)" }}>{saving ? "保存中..." : "保存配置"}</button></div>
      </form>

      {/* API Keys */}
      <form onSubmit={handleSave} className="rounded-2xl border p-6 mb-6" style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
        <h2 className="text-lg font-semibold mb-1" style={{ color: "var(--text-primary)" }}>API 密钥</h2>
        <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>密钥加密存储在数据库，仅服务端可读，前端不会暴露。</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {Object.entries(KEY_LABELS).map(([key, label]) => {
            const status = config[key] || "";
            const isSet = status.includes("已设置");
            return (
              <div key={key}>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>{label}</label>
                <div className="flex items-center gap-2">
                  <input name={key} type="password" className="flex-1 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--border)", background: "var(--bg-tertiary)", color: "var(--text-primary)" }} placeholder={isSet ? "••••••••（已设置）" : "sk-..."} />
                  {isSet && <span className="text-xs shrink-0" style={{ color: "var(--success)" }}>✓</span>}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4"><button type="submit" disabled={saving} className="rounded-lg px-6 py-2.5 text-sm font-medium text-white transition-all disabled:opacity-50" style={{ background: "var(--accent)" }}>{saving ? "保存中..." : "保存密钥"}</button></div>
      </form>

      {message && (
        <div className="text-sm text-center p-3 rounded-lg" style={{ background: message.includes("成功") || message.includes("找到") ? "var(--success-bg)" : "var(--danger-bg)", color: message.includes("成功") || message.includes("找到") ? "var(--success)" : "var(--danger)" }}>{message}</div>
      )}
    </div>
  );
}
