"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/* ─── types ─── */
interface HistoryItem { id: number; keywordNames: string; prompt: string; imagePath: string; type: string; posterPath: string; createdAt: string; }
interface KeywordGroup { id: number; name: string; slug: string; keywords: { id: number; name: string }[]; }

const MODEL_GROUPS = [
  { key: "llm", title: "LLM 文字模型", desc: "提示词生成 / 润色", icon: "🧠", ep: "llm_endpoint", mk: "llm_model", ak: "llm_api_key" },
  { key: "image", title: "图像模型", desc: "文生图 / 图生图", icon: "🎨", ep: "image_endpoint", mk: "image_model", ak: "image_api_key" },
  { key: "video", title: "视频模型", desc: "文生视频 / 图生视频", icon: "🎬", ep: "video_endpoint", mk: "video_model", ak: "video_api_key" },
];

const PROMPT_CONFIGS = [
  { key: "prompt_system_image", label: "关键词生图提示词", desc: "根据关键词生成画面描述时使用的系统提示词", icon: "🎨" },
  { key: "prompt_system_video", label: "视频生成提示词", desc: "生成视频画面描述时使用的系统提示词", icon: "🎬" },
  { key: "prompt_system_polish", label: "润色提示词", desc: "润色用户输入的画面描述时使用的系统提示词", icon: "✨" },
];

const MENU_ITEMS = [
  { key: "endpoints", label: "端点配置", icon: "⚙️" },
  { key: "prompts", label: "提示词设定", icon: "📝" },
  { key: "history", label: "生成历史", icon: "📋" },
  { key: "keywords", label: "关键词管理", icon: "🏷️" },
];

// Drag-to-reorder keyword group card with touch support
function KeywordGroupCard({ group, newKw, onNewKwChange, onAdd, onDelete, onReorder }: {
  group: KeywordGroup;
  newKw: string;
  onNewKwChange: (v: string) => void;
  onAdd: () => void;
  onDelete: (id: number) => void;
  onReorder: (orderedIds: number[]) => void;
}) {
  const [dragId, setDragId] = useState<number | null>(null);
  const [overId, setOverId] = useState<number | null>(null);
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const touchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleDragStart(e: React.DragEvent, id: number) {
    setDragId(id);
    e.dataTransfer.effectAllowed = "move";
  }
  function handleDragOver(e: React.DragEvent, id: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (id !== dragId) setOverId(id);
  }
  function handleDrop(e: React.DragEvent, id: number) {
    e.preventDefault();
    if (dragId === null || dragId === id) { setDragId(null); setOverId(null); return; }
    const ids = group.keywords.map(k => k.id);
    const fromIdx = ids.indexOf(dragId);
    const toIdx = ids.indexOf(id);
    if (fromIdx < 0 || toIdx < 0) { setDragId(null); setOverId(null); return; }
    ids.splice(fromIdx, 1);
    ids.splice(toIdx, 0, dragId);
    onReorder(ids);
    setDragId(null);
    setOverId(null);
  }
  function handleDragEnd() { setDragId(null); setOverId(null); }

  // Touch handlers for mobile long-press drag
  function handleTouchStart(e: React.TouchEvent, id: number) {
    const t = e.touches[0];
    setDragStartPos({ x: t.clientX, y: t.clientY });
    touchTimer.current = setTimeout(() => {
      setIsDragging(true);
      setDragId(id);
    }, 400);
  }
  function handleTouchMove(e: React.TouchEvent) {
    if (touchTimer.current && !isDragging) {
      const t = e.touches[0];
      if (dragStartPos && (Math.abs(t.clientX - dragStartPos.x) > 10 || Math.abs(t.clientY - dragStartPos.y) > 10)) {
        clearTimeout(touchTimer.current);
        touchTimer.current = null;
      }
    }
    if (isDragging) {
      e.preventDefault();
      const t = e.touches[0];
      const el = document.elementFromPoint(t.clientX, t.clientY);
      const chip = el?.closest("[data-kid]");
      if (chip) {
        const kid = parseInt(chip.getAttribute("data-kid") || "0");
        if (kid && kid !== dragId) setOverId(kid);
      }
    }
  }
  function handleTouchEnd(e: React.TouchEvent) {
    if (touchTimer.current) { clearTimeout(touchTimer.current); touchTimer.current = null; }
    if (isDragging && dragId !== null && overId !== null && dragId !== overId) {
      const ids = group.keywords.map(k => k.id);
      const fromIdx = ids.indexOf(dragId);
      const toIdx = ids.indexOf(overId);
      if (fromIdx >= 0 && toIdx >= 0) {
        ids.splice(fromIdx, 1);
        ids.splice(toIdx, 0, dragId);
        onReorder(ids);
      }
    }
    setIsDragging(false);
    setDragId(null);
    setOverId(null);
    setDragStartPos(null);
  }

  return (
    <div className="rounded-xl border p-5" style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{group.name}</span>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>{group.keywords.length} 个</span>
      </div>
      <div className="flex flex-wrap gap-2 mb-3" onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
        {group.keywords.map(k => {
          const isDrag = dragId === k.id;
          const isOver = overId === k.id;
          return (
            <span
              key={k.id}
              data-kid={k.id}
              draggable={isDragging ? false : true}
              onDragStart={(e) => handleDragStart(e, k.id)}
              onDragOver={(e) => handleDragOver(e, k.id)}
              onDrop={(e) => handleDrop(e, k.id)}
              onDragEnd={handleDragEnd}
              onTouchStart={(e) => handleTouchStart(e, k.id)}
              className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs cursor-grab active:cursor-grabbing select-none transition-all"
              style={{
                borderColor: isOver ? "var(--accent)" : "var(--border)",
                background: isDrag ? "var(--accent-light)" : isOver ? "var(--accent-light)" : "var(--bg-tertiary)",
                color: isDrag ? "var(--accent)" : "var(--text-secondary)",
                opacity: isDrag ? 0.5 : 1,
                transform: isOver ? "scale(1.05)" : "scale(1)",
                touchAction: "none",
              }}
            >
              <span style={{ opacity: 0.4, fontSize: "10px" }}>⠿</span>
              {k.name}
              <button onClick={(e) => { e.stopPropagation(); onDelete(k.id); }} className="opacity-50 hover:opacity-100" style={{ color: "var(--danger)" }}>×</button>
            </span>
          );
        })}
      </div>
      <div className="flex gap-2">
        <input value={newKw} onChange={(e) => onNewKwChange(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), onAdd())} className="flex-1 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--border)", background: "var(--bg-tertiary)", color: "var(--text-primary)" }} placeholder="添加关键词..." />
        <button onClick={onAdd} className="rounded-lg px-4 py-2 text-xs font-medium text-white" style={{ background: "var(--accent)" }}>添加</button>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [menuKey, setMenuKey] = useState("endpoints");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  /* ─── config state ─── */
  const [config, setConfig] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [fetching, setFetching] = useState<string | null>(null);
  const [modelLists, setModelLists] = useState<Record<string, string[]>>({});
  const [dropdown, setDropdown] = useState<string | null>(null);

  /* ─── prompt state ─── */
  const [promptTexts, setPromptTexts] = useState<Record<string, string>>({});
  const [savingPrompt, setSavingPrompt] = useState(false);

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
      if (r.ok) { const d = await r.json(); setUser(d.data); loadConfig(); } else setLoading(false);
    } catch { setLoading(false); }
  }
  async function loadConfig() {
    try {
      const r = await fetch("/api/config");
      if (r.ok) {
        const d = (await r.json()).data || {};
        setConfig(d);
        // Initialize prompt texts from config
        const pt: Record<string, string> = {};
        for (const p of PROMPT_CONFIGS) pt[p.key] = d[p.key] || "";
        setPromptTexts(pt);
      }
    } catch {}
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

  async function savePrompts() {
    setSavingPrompt(true); setMsg("");
    try {
      const r = await fetch("/api/config", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(promptTexts) });
      if (r.ok) { setMsg("提示词设定保存成功"); loadConfig(); } else setMsg((await r.json()).error || "保存失败");
    } catch { setMsg("网络错误"); }
    setSavingPrompt(false);
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
      if (r.ok) {
        const d = (await r.json()).data || [];
        setHistory(d);
      }
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
    const tempId = Date.now();
    // Optimistic update - add immediately without reload
    setKwGroups(prev => prev.map(g =>
      g.id === groupId ? { ...g, keywords: [...g.keywords, { id: tempId, name }] } : g
    ));
    setNewKw(p => ({ ...p, [groupId]: "" }));
    try {
      const r = await fetch("/api/keywords", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ groupId, name }) });
      if (r.ok) {
        const d = await r.json();
        // Replace temp ID with real ID from server
        setKwGroups(prev => prev.map(g =>
          g.id === groupId ? { ...g, keywords: g.keywords.map(k => k.id === tempId ? { ...k, id: d.data?.id || tempId } : k) } : g
        ));
      }
    } catch {}
  }
  async function deleteKeyword(groupId: number, id: number) {
    // Optimistic update - remove immediately
    setKwGroups(prev => prev.map(g =>
      g.id === groupId ? { ...g, keywords: g.keywords.filter(k => k.id !== id) } : g
    ));
    try { await fetch(`/api/keywords?id=${id}`, { method: "DELETE" }); } catch {}
  }
  async function reorderKeywords(groupId: number, orderedIds: number[]) {
    // Optimistic update
    setKwGroups(prev => prev.map(g => {
      if (g.id !== groupId) return g;
      const map = new Map(g.keywords.map(k => [k.id, k]));
      const reordered = orderedIds.map(id => map.get(id)).filter(Boolean) as typeof g.keywords;
      return { ...g, keywords: reordered };
    }));
    try {
      await fetch("/api/keywords/reorder", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ groupId, orderedIds }) });
    } catch {}
  }

  /* ─── loading ─── */
  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: "var(--border)", borderTopColor: "var(--accent)" }} /></div>;

  /* ─── login form ─── */
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
    <div className="min-h-screen flex" style={{ background: "var(--bg-primary)" }}>
      {/* ─── Left Sidebar ─── */}
      <aside className="w-64 shrink-0 border-r flex flex-col" style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
        <div className="p-5 border-b" style={{ borderColor: "var(--border)" }}>
          <h1 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>⚙️ 后台管理</h1>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{user.username}</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {MENU_ITEMS.map(item => (
            <button key={item.key} onClick={() => {
              setMenuKey(item.key);
              setMsg("");
              if (item.key === "history") loadHistory();
              if (item.key === "keywords") loadKeywords();
            }} className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all"
              style={{
                background: menuKey === item.key ? "var(--accent-light)" : "transparent",
                color: menuKey === item.key ? "var(--accent)" : "var(--text-secondary)",
                borderLeft: menuKey === item.key ? "3px solid var(--accent)" : "3px solid transparent",
              }}>
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="p-3 border-t" style={{ borderColor: "var(--border)" }}>
          <button onClick={() => router.push("/")} className="w-full rounded-lg border px-3 py-2 text-xs font-medium" style={{ borderColor: "var(--border)", color: "var(--text-secondary)", background: "var(--bg-tertiary)" }}>← 返回创作台</button>
        </div>
      </aside>

      {/* ─── Right Content ─── */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-8">
          {msg && <div className="mb-4 rounded-lg px-4 py-3 text-sm" style={{ background: msg.includes("成功") ? "var(--success-bg)" : "var(--accent-light)", color: msg.includes("成功") ? "var(--success)" : "var(--accent)" }}>{msg}</div>}

          {/* ── 端点配置 ── */}
          {menuKey === "endpoints" && (
            <div>
              <h2 className="text-xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>端点配置</h2>
              <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>配置 LLM、图像、视频三类模型的端点和密钥</p>
              <div className="space-y-5">
                {MODEL_GROUPS.map(g => {
                  const hasKey = (config[g.ak] || "").includes("已设置");
                  return (
                    <form key={g.key} onSubmit={(e) => saveGroup(g.key, e)} className="rounded-xl border p-5" style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
                      <div className="flex items-center gap-3 mb-4">
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg text-lg" style={{ background: "var(--accent-light)" }}>{g.icon}</span>
                        <div>
                          <div className="text-sm font-semibold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>{g.title}{hasKey && <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "var(--success-bg)", color: "var(--success)" }}>✓ Key 已设置</span>}</div>
                          <div className="text-xs" style={{ color: "var(--text-muted)" }}>{g.desc}</div>
                        </div>
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
            </div>
          )}

          {/* ── 提示词设定 ── */}
          {menuKey === "prompts" && (
            <div>
              <h2 className="text-xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>提示词设定</h2>
              <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>配置不同场景下 AI 生成/润色提示词时使用的系统提示词。留空则使用默认值。</p>
              <div className="space-y-5">
                {PROMPT_CONFIGS.map(p => (
                  <div key={p.key} className="rounded-xl border p-5" style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-lg">{p.icon}</span>
                      <div>
                        <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{p.label}</div>
                        <div className="text-xs" style={{ color: "var(--text-muted)" }}>{p.desc}</div>
                      </div>
                    </div>
                    <textarea
                      value={promptTexts[p.key] || ""}
                      onChange={(e) => setPromptTexts(prev => ({ ...prev, [p.key]: e.target.value }))}
                      rows={8}
                      className="w-full rounded-lg border px-3 py-2.5 text-sm leading-relaxed font-mono resize-y"
                      style={{ borderColor: "var(--border)", background: "var(--bg-tertiary)", color: "var(--text-primary)" }}
                      placeholder="留空使用默认提示词..."
                    />
                    <div className="mt-1.5 text-xs" style={{ color: "var(--text-muted)" }}>{(promptTexts[p.key] || "").length} 字符</div>
                  </div>
                ))}
                <div className="flex gap-3">
                  <button onClick={savePrompts} disabled={savingPrompt} className="rounded-lg px-6 py-2.5 text-sm font-medium text-white transition-all disabled:opacity-50" style={{ background: "var(--accent)" }}>{savingPrompt ? "保存中..." : "保存全部"}</button>
                  <button onClick={() => { setPromptTexts({}); setMsg("已清空编辑区（不影响已保存值）"); }} className="rounded-lg border px-4 py-2.5 text-sm font-medium" style={{ borderColor: "var(--border)", color: "var(--text-secondary)", background: "var(--bg-tertiary)" }}>重置编辑区</button>
                </div>
              </div>
            </div>
          )}

          {/* ── 生成历史 ── */}
          {menuKey === "history" && (
            <div>
              <h2 className="text-xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>生成历史</h2>
              <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>查看所有生成记录</p>
              <div className="rounded-xl border p-5" style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm" style={{ color: "var(--text-muted)" }}>{history.length} 条记录</span>
                  <button onClick={loadHistory} className="text-xs rounded-lg border px-3 py-1.5" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>刷新</button>
                </div>
                {historyLoading ? <div className="text-center py-8 text-sm" style={{ color: "var(--text-muted)" }}>加载中...</div> :
                 history.length === 0 ? <div className="text-center py-8 text-sm" style={{ color: "var(--text-muted)" }}>暂无生成记录</div> :
                 <div className="overflow-x-auto">
                   <table className="w-full text-sm">
                     <thead><tr style={{ color: "var(--text-muted)" }}>
                       <th className="text-left py-2 px-2">类型</th><th className="text-left py-2 px-2">提示词</th><th className="text-left py-2 px-2">图片</th><th className="text-left py-2 px-2">时间</th><th className="py-2 px-2"></th>
                     </tr></thead>
                     <tbody>{history.map(h => (
                       <tr key={h.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                         <td className="py-2 px-2"><span className="text-xs rounded px-1.5 py-0.5" style={{ background: h.type === "video" ? "var(--accent-light)" : "var(--success-bg)", color: h.type === "video" ? "var(--accent)" : "var(--success)" }}>{h.type}</span></td>
                         <td className="py-2 px-2 max-w-xs truncate" style={{ color: "var(--text-secondary)" }}>{h.prompt || h.keywordNames}</td>
                         <td className="py-2 px-2">{h.imagePath ? <a href={h.imagePath} target="_blank" className="text-xs" style={{ color: "var(--accent)" }}>查看</a> : "—"}</td>
                         <td className="py-2 px-2 text-xs" style={{ color: "var(--text-muted)" }}>{new Date(h.createdAt).toLocaleString("zh-CN")}</td>
                         <td className="py-2 px-2"><button onClick={() => deleteHistory(h.id)} className="text-xs" style={{ color: "var(--danger)" }}>删除</button></td>
                       </tr>
                     ))}</tbody>
                   </table>
                 </div>
                }
              </div>
            </div>
          )}

          {/* ── 关键词管理 ── */}
          {menuKey === "keywords" && (
            <div>
              <h2 className="text-xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>关键词管理</h2>
              <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>长按拖拽关键词排序，点击 × 删除</p>
              <div className="space-y-4">
                {kwLoading ? <div className="text-center py-8 text-sm" style={{ color: "var(--text-muted)" }}>加载中...</div> :
                 kwGroups.map(g => (
                  <KeywordGroupCard key={g.id} group={g} newKw={newKw[g.id] || ""} onNewKwChange={(v) => setNewKw(p => ({ ...p, [g.id]: v }))} onAdd={() => addKeyword(g.id)} onDelete={(kid) => deleteKeyword(g.id, kid)} onReorder={(ids) => reorderKeywords(g.id, ids)} />
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
