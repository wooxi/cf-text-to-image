"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

/* ─── types ─── */
interface HistoryItem { id: number; keyword_names: string; prompt: string; image_path: string; type: string; poster_path: string; created_at: string; }
interface KeywordGroup { id: number; name: string; slug: string; keywords: { id: number; name: string }[]; }

const MODEL_GROUPS = [
  { key: "llm", title: "LLM 文字模型", desc: "提示词生成 / 润色", ep: "llm_endpoint", mk: "llm_model", ak: "llm_api_key" },
  { key: "image", title: "图像模型", desc: "文生图 / 图生图", ep: "image_endpoint", mk: "image_model", ak: "image_api_key" },
  { key: "video", title: "视频模型", desc: "文生视频 / 图生视频", ep: "video_endpoint", mk: "video_model", ak: "video_api_key" },
];
const TABS = ["端点配置", "生成历史", "关键词管理"];

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  /* ─── config state ─── */
  const [config, setConfig] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [fetching, setFetching] = useState<string | null>(null);
  const [modelLists, setModelLists] = useState<Record<string, string[]>>({});
  const [dropdown, setDropdown] = useState<string | null>(null);

  /* ─── history state ─── */
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  /* ─── keywords state ─── */
  const [kwGroups, setKwGroups] = useState<KeywordGroup[]>([]);
  const [kwLoading, setKwLoading] = useState(false);
  const [newKw, setNewKw] = useState<Record<number, string>>({});

  /* ─── init ─── */
  useEffect(() => { checkAuth(); }, []);
  async function checkAuth() {
    try {
      const r = await fetch("/api/auth/me");
      if (r.ok) { setUser((await r.json()).data); loadConfig(); } else setLoading(false);
    } catch { setLoading(false); }
  }
  async function loadConfig() {
    try { const r = await fetch("/api/config"); if (r.ok) setConfig((await r.json()).data || {}); } catch {}
    setLoading(false);
  }

  /* ─── login ─── */
  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); const fd = new FormData(e.currentTarget);
    try {
      const r = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: fd.get("username"), password: fd.get("password") }) });
      if (r.ok) { setUser((await r.json()).data); loadConfig(); } else setMsg((await r.json()).error || "登录失败");
    } catch { setMsg("网络错误"); }
  }

  /* ─── config save ─── */
  async function saveGroup(gk: string, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setSaving(gk); setMsg("");
    const fd = new FormData(e.currentTarget);
    const up: Record<string, string> = {};
    for (const [k, v] of fd.entries()) if (typeof v === "string" && v.trim()) up[k] = v.trim();
    try {
      const r = await fetch("/api/config", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(up) });
      if (r.ok) { setMsg(gk + " 保存成功"); loadConfig(); } else setMsg((await r.json()).error || "保存失败");
    } catch { setMsg("网络错误"); }
    setSaving(null);
  }

  async function fetchModels(gk: string, epKey: string) {
    const ep = (document.querySelector(`input[name="${epKey}"]`) as HTMLInputElement)?.value?.trim();
    if (!ep) { setMsg("请先填写端点地址"); return; }
    setFetching(gk); setMsg("");
    try {
      const r = await fetch("/api/models", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: ep }) });
      const d = await r.json();
      if (d.success) { setModelLists(p => ({ ...p, [gk]: d.data })); setDropdown(gk); setMsg(`找到 ${d.data.length} 个模型`); }
      else setMsg(d.error || "获取失败");
    } catch { setMsg("网络错误"); }
    setFetching(null);
  }

  function pickModel(mk: string, name: string) {
    const inp = document.querySelector(`input[name="${mk}"]`) as HTMLInputElement;
    if (inp) { const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set; s?.call(inp, name); inp.dispatchEvent(new Event("input", { bubbles: true })); }
    setDropdown(null);
  }

  /* ─── history ─── */
  async function loadHistory() {
    setHistoryLoading(true);
    try {
      const r = await fetch("/api/history");
      if (r.ok) setHistory((await r.json()).data || []);
    } catch {}
    setHistoryLoading(false);
  }
  async function deleteHistory(id: number) {
    if (!confirm("确定删除？")) return;
    await fetch(`/api/history?id=${id}`, { method: "DELETE" });
    setHistory(p => p.filter(h => h.id !== id));
  }

  /* ─── keywords ─── */
  async function loadKeywords() {
    setKwLoading(true);
    try {
      const r = await fetch("/api/keywords");
      if (r.ok) setKwGroups((await r.json()).data || []);
    } catch {}
    setKwLoading(false);
  }
  async function addKeyword(groupId: number) {
    const name = (newKw[groupId] || "").trim();
    if (!name) return;
    try {
      const r = await fetch("/api/keywords", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "add", group_id: groupId, name }) });
      if (r.ok) { setMsg("添加成功"); setNewKw(p => ({ ...p, [groupId]: "" })); loadKeywords(); }
      else setMsg((await r.json()).error || "添加失败");
    } catch { setMsg("网络错误"); }
  }
  async function deleteKeyword(id: number) {
    try {
      const r = await fetch("/api/keywords", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", id }) });
      if (r.ok) { loadKeywords(); } else setMsg((await r.json()).error || "删除失败");
    } catch { setMsg("网络错误"); }
  }

  /* ─── tab switching loads data ─── */
  useEffect(() => {
    if (!user) return;
    if (tab === 1) loadHistory();
    if (tab === 2) loadKeywords();
  }, [tab, user]);

  /* ─── render ─── */
  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: "var(--border)", borderTopColor: "var(--accent)" }} /></div>;

  if (!user) return (
    <div className="max-w-md mx-auto px-4 py-16">
      <h1 className="text-2xl font-bold mb-8 text-center" style={{ color: "var(--text-primary)" }}>后台管理</h1>
      <form onSubmit={handleLogin} className="rounded-2xl border p-6" style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
        <div className="mb-4"><label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>用户名</label><input name="username" required className="w-full rounded-lg border px-3 py-2.5 text-sm" style={{ borderColor: "var(--border)", background: "var(--bg-tertiary)", color: "var(--text-primary)" }} placeholder="admin" /></div>
        <div className="mb-6"><label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>密码</label><input name="password" type="password" required className="w-full rounded-lg border px-3 py-2.5 text-sm" style={{ borderColor: "var(--border)", background: "var(--bg-tertiary)", color: "var(--text-primary)" }} placeholder="••••••" /></div>
        {msg && <p className="text-sm mb-4 text-center" style={{ color: "var(--danger)" }}>{msg}</p>}
        <button type="submit" className="w-full rounded-lg py-2.5 text-sm font-medium text-white" style={{ background: "var(--accent)" }}>登录</button>
      </form>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>后台管理</h1><p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>已登录：{user.username}</p></div>
        <button onClick={() => router.push("/")} className="rounded-full border px-4 py-2 text-sm font-medium" style={{ borderColor: "var(--border)", color: "var(--text-secondary)", background: "var(--bg-secondary)" }}>← 返回创作台</button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-full border p-1 mb-6" style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)} className="rounded-full px-5 py-2 text-sm font-medium transition-all"
            style={{ background: tab === i ? "var(--accent)" : "transparent", color: tab === i ? "#fff" : "var(--text-secondary)" }}>
            {t}
          </button>
        ))}
      </div>

      {/* Tab 0: 端点配置 */}
      {tab === 0 && (
        <div className="grid gap-6">
          {MODEL_GROUPS.map(g => {
            const hasKey = (config[g.ak] || "").includes("已设置");
            return (
              <form key={g.key} onSubmit={(e) => saveGroup(g.key, e)} className="rounded-2xl border p-6" style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
                <div className="flex items-center gap-3 mb-5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold" style={{ background: "var(--accent-light)", color: "var(--accent)" }}>{g.key === "llm" ? "T" : g.key === "image" ? "I" : "V"}</span>
                  <div><h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>{g.title}</h2><p className="text-xs" style={{ color: "var(--text-muted)" }}>{g.desc}</p></div>
                  {hasKey && <span className="ml-auto text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--success-bg)", color: "var(--success)" }}>✓ Key 已设置</span>}
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div><label className="block text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>端点地址</label><input name={g.ep} type="text" defaultValue={config[g.ep] || ""} className="w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--border)", background: "var(--bg-tertiary)", color: "var(--text-primary)" }} placeholder="https://api.openai.com/v1" /></div>
                  <div><label className="block text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>API Key</label><input name={g.ak} type="password" className="w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--border)", background: "var(--bg-tertiary)", color: "var(--text-primary)" }} placeholder={hasKey ? "••••••••（已设置）" : "sk-..."} /></div>
                  <div><label className="block text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>模型名称</label>
                    <div className="flex gap-1.5">
                      <input name={g.mk} type="text" defaultValue={config[g.mk] || ""} className="flex-1 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--border)", background: "var(--bg-tertiary)", color: "var(--text-primary)" }} placeholder="gpt-4o" />
                      <button type="button" onClick={() => fetchModels(g.key, g.ep)} disabled={fetching === g.key} className="shrink-0 rounded-lg border px-2.5 py-2 text-xs font-medium disabled:opacity-50" style={{ borderColor: "var(--accent)", color: "var(--accent)", background: "var(--accent-light)" }}>{fetching === g.key ? "..." : "获取"}</button>
                    </div>
                    {dropdown === g.key && modelLists[g.key]?.length > 0 && (
                      <div className="mt-1.5 rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)", background: "var(--bg-tertiary)" }}>
                        <div className="max-h-40 overflow-y-auto">{modelLists[g.key].map(m => <button key={m} type="button" onClick={() => pickModel(g.mk, m)} className="w-full text-left px-3 py-1.5 text-xs hover:bg-[var(--accent-light)] block" style={{ color: "var(--text-secondary)" }}>{m}</button>)}</div>
                        <div className="border-t px-2 py-1" style={{ borderColor: "var(--border)" }}><button type="button" onClick={() => setDropdown(null)} className="text-[10px]" style={{ color: "var(--text-muted)" }}>关闭</button></div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-4"><button type="submit" disabled={saving === g.key} className="rounded-lg px-5 py-2 text-xs font-medium text-white transition-all disabled:opacity-50" style={{ background: "var(--accent)" }}>{saving === g.key ? "保存中..." : "保存"}</button></div>
              </form>
            );
          })}
        </div>
      )}

      {/* Tab 1: 生成历史 */}
      {tab === 1 && (
        <div className="rounded-2xl border p-6" style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>生成历史</h2>
            <button onClick={loadHistory} className="text-xs rounded-lg border px-3 py-1.5" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>刷新</button>
          </div>
          {historyLoading ? <div className="text-center py-8 text-sm" style={{ color: "var(--text-muted)" }}>加载中...</div> :
           history.length === 0 ? <div className="text-center py-8 text-sm" style={{ color: "var(--text-muted)" }}>暂无生成记录</div> :
           <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr style={{ color: "var(--text-muted)" }}><th className="text-left pb-2 font-medium">ID</th><th className="text-left pb-2 font-medium">类型</th><th className="text-left pb-2 font-medium">关键词</th><th className="text-left pb-2 font-medium">提示词</th><th className="text-left pb-2 font-medium">预览</th><th className="text-left pb-2 font-medium">时间</th><th className="text-right pb-2 font-medium">操作</th></tr></thead>
              <tbody>
                {history.map(h => (
                  <tr key={h.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                    <td className="py-2 text-xs" style={{ color: "var(--text-muted)" }}>{h.id}</td>
                    <td className="py-2 text-xs">{h.type === "video" ? "🎬" : "🖼️"}</td>
                    <td className="py-2 text-xs max-w-[120px] truncate" style={{ color: "var(--text-secondary)" }}>{h.keyword_names}</td>
                    <td className="py-2 text-xs max-w-[200px] truncate" style={{ color: "var(--text-secondary)" }}>{h.prompt}</td>
                    <td className="py-2">{h.image_path ? <a href={h.image_path} target="_blank" className="text-xs underline" style={{ color: "var(--accent)" }}>查看</a> : <span className="text-xs" style={{ color: "var(--text-muted)" }}>-</span>}</td>
                    <td className="py-2 text-xs" style={{ color: "var(--text-muted)" }}>{h.created_at?.substring(0, 16)}</td>
                    <td className="py-2 text-right"><button onClick={() => deleteHistory(h.id)} className="text-xs hover:underline" style={{ color: "var(--danger)" }}>删除</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>}
        </div>
      )}

      {/* Tab 2: 关键词管理 */}
      {tab === 2 && (
        <div className="rounded-2xl border p-6" style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>关键词管理</h2>
            <button onClick={loadKeywords} className="text-xs rounded-lg border px-3 py-1.5" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>刷新</button>
          </div>
          {kwLoading ? <div className="text-center py-8 text-sm" style={{ color: "var(--text-muted)" }}>加载中...</div> :
           <div className="grid gap-4 sm:grid-cols-2">
            {kwGroups.map(g => (
              <div key={g.id} className="rounded-lg border p-4" style={{ borderColor: "var(--border)", background: "var(--bg-tertiary)" }}>
                <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>{g.name}</h3>
                <p className="text-[10px] mb-3" style={{ color: "var(--text-muted)" }}>{g.keywords?.length || 0} 个关键词</p>
                <div className="flex flex-wrap gap-1 mb-3">
                  {g.keywords?.map(k => (
                    <span key={k.id} className="group flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                      {k.name}
                      <button onClick={() => deleteKeyword(k.id)} className="opacity-0 group-hover:opacity-100 text-[10px] ml-0.5" style={{ color: "var(--danger)" }}>×</button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-1.5">
                  <input value={newKw[g.id] || ""} onChange={e => setNewKw(p => ({ ...p, [g.id]: e.target.value }))} className="flex-1 rounded-md border px-2 py-1 text-xs" style={{ borderColor: "var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)" }} placeholder="新关键词" onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addKeyword(g.id))} />
                  <button onClick={() => addKeyword(g.id)} className="rounded-md border px-3 py-1 text-xs font-medium" style={{ borderColor: "var(--accent)", color: "var(--accent)", background: "var(--accent-light)" }}>+</button>
                </div>
              </div>
            ))}
          </div>}
        </div>
      )}

      {msg && (
        <div className="mt-4 text-sm text-center p-3 rounded-lg" style={{ background: msg.includes("成功") || msg.includes("找到") ? "var(--success-bg)" : "var(--danger-bg)", color: msg.includes("成功") || msg.includes("找到") ? "var(--success)" : "var(--danger)" }}>{msg}</div>
      )}
    </div>
  );
}
