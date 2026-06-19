"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const MODEL_GROUPS = [
  { key: "llm", title: "LLM 文字模型", desc: "生成提示词 / 润色", endpointKey: "llm_endpoint", modelKey: "llm_model", apiKeyName: "llm_api_key" },
  { key: "image", title: "图像模型", desc: "文生图 / 图生图", endpointKey: "image_endpoint", modelKey: "image_model", apiKeyName: "image_api_key" },
  { key: "video", title: "视频模型", desc: "文生视频 / 图生视频", endpointKey: "video_endpoint", modelKey: "video_model", apiKeyName: "video_api_key" },
];

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [config, setConfig] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [fetching, setFetching] = useState<string | null>(null);
  const [modelLists, setModelLists] = useState<Record<string, string[]>>({});
  const [dropdown, setDropdown] = useState<string | null>(null);

  useEffect(() => { checkAuth(); }, []);

  async function checkAuth() {
    try {
      const r = await fetch("/api/auth/me");
      if (r.ok) { const d = await r.json(); setUser(d.data); loadConfig(); }
      else setLoading(false);
    } catch { setLoading(false); }
  }

  async function loadConfig() {
    try {
      const r = await fetch("/api/config");
      if (r.ok) setConfig((await r.json()).data || {});
    } catch {}
    setLoading(false);
  }

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: fd.get("username"), password: fd.get("password") }),
      });
      if (r.ok) { const d = await r.json(); setUser(d.data); loadConfig(); }
      else setMessage((await r.json()).error || "登录失败");
    } catch { setMessage("网络错误"); }
  }

  async function handleSave(groupKey: string, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(groupKey); setMessage("");
    const fd = new FormData(e.currentTarget);
    const updates: Record<string, string> = {};
    for (const [k, v] of fd.entries()) {
      if (typeof v === "string" && v.trim()) updates[k] = v.trim();
    }
    try {
      const r = await fetch("/api/config", {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updates),
      });
      if (r.ok) { setMessage(groupKey + " 保存成功"); loadConfig(); }
      else setMessage((await r.json()).error || "保存失败");
    } catch { setMessage("网络错误"); }
    setSaving(null);
  }

  async function fetchModels(group: typeof MODEL_GROUPS[0]) {
    const ep = (document.querySelector(`input[name="${group.endpointKey}"]`) as HTMLInputElement)?.value?.trim();
    if (!ep) { setMessage("请先填写端点地址"); return; }
    setFetching(group.key); setMessage("");
    try {
      const r = await fetch("/api/models", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: ep }) });
      const d = await r.json();
      if (d.success) { setModelLists(p => ({ ...p, [group.key]: d.data })); setDropdown(group.key); setMessage(`找到 ${d.data.length} 个模型`); }
      else setMessage(d.error || "获取失败");
    } catch { setMessage("网络错误"); }
    setFetching(null);
  }

  function selectModel(modelKey: string, name: string) {
    const inp = document.querySelector(`input[name="${modelKey}"]`) as HTMLInputElement;
    if (inp) { const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set; s?.call(inp, name); inp.dispatchEvent(new Event("input", { bubbles: true })); }
    setDropdown(null);
  }

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: "var(--border)", borderTopColor: "var(--accent)" }} /></div>;

  if (!user) return (
    <div className="max-w-md mx-auto px-4 py-16">
      <h1 className="text-2xl font-bold mb-8 text-center" style={{ color: "var(--text-primary)" }}>后台管理</h1>
      <form onSubmit={handleLogin} className="rounded-2xl border p-6" style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
        <div className="mb-4"><label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>用户名</label><input name="username" required className="w-full rounded-lg border px-3 py-2.5 text-sm" style={{ borderColor: "var(--border)", background: "var(--bg-tertiary)", color: "var(--text-primary)" }} placeholder="admin" /></div>
        <div className="mb-6"><label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>密码</label><input name="password" type="password" required className="w-full rounded-lg border px-3 py-2.5 text-sm" style={{ borderColor: "var(--border)", background: "var(--bg-tertiary)", color: "var(--text-primary)" }} placeholder="••••••" /></div>
        {message && <p className="text-sm mb-4 text-center" style={{ color: "var(--danger)" }}>{message}</p>}
        <button type="submit" className="w-full rounded-lg py-2.5 text-sm font-medium text-white" style={{ background: "var(--accent)" }}>登录</button>
      </form>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div><h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>后台管理</h1><p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>已登录：{user.username}</p></div>
        <button onClick={() => router.push("/")} className="rounded-full border px-4 py-2 text-sm font-medium" style={{ borderColor: "var(--border)", color: "var(--text-secondary)", background: "var(--bg-secondary)" }}>← 返回创作台</button>
      </div>

      <div className="grid gap-6">
        {MODEL_GROUPS.map(group => {
          const keyStatus = config[group.apiKeyName] || "";
          const hasKey = keyStatus.includes("已设置");
          return (
            <form key={group.key} onSubmit={(e) => handleSave(group.key, e)} className="rounded-2xl border p-6" style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
              <div className="flex items-center gap-3 mb-5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold" style={{ background: "var(--accent-light)", color: "var(--accent)" }}>
                  {group.key === "llm" ? "T" : group.key === "image" ? "I" : "V"}
                </span>
                <div>
                  <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>{group.title}</h2>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>{group.desc}</p>
                </div>
                {hasKey && <span className="ml-auto text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--success-bg)", color: "var(--success)" }}>✓ Key 已设置</span>}
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                {/* Endpoint */}
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>端点地址</label>
                  <input name={group.endpointKey} type="text" defaultValue={config[group.endpointKey] || ""} className="w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--border)", background: "var(--bg-tertiary)", color: "var(--text-primary)" }} placeholder="https://api.openai.com/v1" />
                </div>
                {/* Key */}
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>API Key</label>
                  <input name={group.apiKeyName} type="password" className="w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--border)", background: "var(--bg-tertiary)", color: "var(--text-primary)" }} placeholder={hasKey ? "••••••••（已设置）" : "sk-..."} />
                </div>
                {/* Model */}
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>模型名称</label>
                  <div className="flex gap-1.5">
                    <input name={group.modelKey} type="text" defaultValue={config[group.modelKey] || ""} className="flex-1 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--border)", background: "var(--bg-tertiary)", color: "var(--text-primary)" }} placeholder={group.key === "llm" ? "gpt-4o" : group.key === "image" ? "dall-e-3" : "agnes-video-v2.0"} />
                    <button type="button" onClick={() => fetchModels(group)} disabled={fetching === group.key} className="shrink-0 rounded-lg border px-2.5 py-2 text-xs font-medium disabled:opacity-50" style={{ borderColor: "var(--accent)", color: "var(--accent)", background: "var(--accent-light)" }}>
                      {fetching === group.key ? "..." : "获取"}
                    </button>
                  </div>
                  {dropdown === group.key && modelLists[group.key]?.length > 0 && (
                    <div className="mt-1.5 rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)", background: "var(--bg-tertiary)" }}>
                      <div className="max-h-40 overflow-y-auto">
                        {modelLists[group.key].map(m => <button key={m} type="button" onClick={() => selectModel(group.modelKey, m)} className="w-full text-left px-3 py-1.5 text-xs hover:bg-[var(--accent-light)] block" style={{ color: "var(--text-secondary)" }}>{m}</button>)}
                      </div>
                      <div className="border-t px-2 py-1" style={{ borderColor: "var(--border)" }}><button type="button" onClick={() => setDropdown(null)} className="text-[10px]" style={{ color: "var(--text-muted)" }}>关闭</button></div>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4">
                <button type="submit" disabled={saving === group.key} className="rounded-lg px-5 py-2 text-xs font-medium text-white transition-all disabled:opacity-50" style={{ background: "var(--accent)" }}>
                  {saving === group.key ? "保存中..." : `保存 ${group.title}`}
                </button>
              </div>
            </form>
          );
        })}
      </div>

      {message && (
        <div className="mt-4 text-sm text-center p-3 rounded-lg" style={{ background: message.includes("成功") || message.includes("找到") ? "var(--success-bg)" : "var(--danger-bg)", color: message.includes("成功") || message.includes("找到") ? "var(--success)" : "var(--danger)" }}>{message}</div>
      )}

      <div className="mt-6 p-4 rounded-lg" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>🔐 密钥加密存储在数据库，仅服务端可读，前端和 API 均不会返回明文。</p>
      </div>
    </div>
  );
}
