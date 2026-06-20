"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/* ─── types ─── */
interface HistoryItem { id: number; keywordNames: string; prompt: string; imagePath: string; type: string; posterPath: string; createdAt: string; size: string; status: string; error: string; }
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

// Drag-to-reorder keyword chips — unified pointer events (mouse + touch)
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
  const [ghost, setGhost] = useState<{ x: number; y: number; name: string } | null>(null);
  const dragRef = useRef<{
    id: number;
    name: string;
    pointerId: number;
    longPress: boolean;
    timer: ReturnType<typeof setTimeout> | null;
    moved: boolean;
  } | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  function doReorder(fromId: number, toId: number) {
    if (fromId === toId) return;
    const ids = group.keywords.map(k => k.id);
    const fromIdx = ids.indexOf(fromId);
    const toIdx = ids.indexOf(toId);
    if (fromIdx < 0 || toIdx < 0) return;
    ids.splice(fromIdx, 1);
    ids.splice(toIdx, 0, fromId);
    onReorder(ids);
  }

  function clearDrag() {
    if (dragRef.current?.timer) clearTimeout(dragRef.current.timer);
    dragRef.current = null;
    setDragId(null);
    setOverId(null);
    setGhost(null);
  }

  function handlePointerDown(e: React.PointerEvent, id: number, name: string) {
    // Only primary button (left click / touch)
    if (e.button !== 0 && e.pointerType === "mouse") return;
    const isTouch = e.pointerType === "touch";
    const x = e.clientX;
    const y = e.clientY;

    const timer = isTouch ? setTimeout(() => {
      if (!dragRef.current) return;
      dragRef.current.longPress = true;
      setDragId(dragRef.current.id);
      setGhost({ x, y, name: dragRef.current.name });
      // vibrate feedback on mobile
      if (navigator.vibrate) navigator.vibrate(30);
    }, 300) : null;

    dragRef.current = { id, name, pointerId: e.pointerId, longPress: !isTouch, timer, moved: false };

    // For mouse: start dragging immediately
    if (!isTouch) {
      setDragId(id);
      setGhost({ x, y, name });
    }
  }

  function handlePointerMove(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d || !d.longPress) return;
    d.moved = true;
    e.preventDefault();
    const x = e.clientX;
    const y = e.clientY;
    setGhost({ x, y, name: d.name });
    // Find chip under pointer (dragged chip has pointer-events:none)
    const el = document.elementFromPoint(x, y);
    const chip = el?.closest("[data-kid]") as HTMLElement | null;
    if (chip) {
      const kid = parseInt(chip.getAttribute("data-kid") || "0");
      if (kid && kid !== d.id) setOverId(kid);
      else setOverId(null);
    } else {
      setOverId(null);
    }
  }

  function handlePointerUp(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d) return;
    if (d.longPress) {
      // Find final target
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const chip = el?.closest("[data-kid]") as HTMLElement | null;
      if (chip) {
        const kid = parseInt(chip.getAttribute("data-kid") || "0");
        if (kid && kid !== d.id) doReorder(d.id, kid);
      }
    }
    clearDrag();
  }

  return (
    <div className="rounded-xl border p-5" style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{group.name}</span>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>{group.keywords.length} 个</span>
      </div>
      <div
        ref={containerRef}
        className="flex flex-wrap gap-2 mb-3"
        style={{ touchAction: "none" }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {group.keywords.map(k => {
          const isDrag = dragId === k.id;
          const isOver = overId === k.id;
          return (
            <span
              key={k.id}
              data-kid={k.id}
              onPointerDown={(e) => handlePointerDown(e, k.id, k.name)}
              className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs select-none"
              style={{
                borderColor: isOver ? "var(--accent)" : "var(--border)",
                background: isDrag ? "var(--accent-light)" : isOver ? "var(--accent-light)" : "var(--bg-tertiary)",
                color: isDrag ? "var(--accent)" : "var(--text-secondary)",
                opacity: isDrag ? 0.25 : 1,
                transform: isOver ? "scale(1.08)" : "scale(1)",
                touchAction: "none",
                pointerEvents: isDrag ? "none" : "auto",
                cursor: "grab",
              }}
            >
              <span style={{ opacity: 0.4, fontSize: "10px" }}>⠿</span>
              {k.name}
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); e.preventDefault(); onDelete(k.id); }}
                className="opacity-50 hover:opacity-100"
                style={{ color: "var(--danger)" }}
              >×</button>
            </span>
          );
        })}
      </div>
      <div className="flex gap-2">
        <input value={newKw} onChange={(e) => onNewKwChange(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), onAdd())} className="flex-1 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--border)", background: "var(--bg-tertiary)", color: "var(--text-primary)" }} placeholder="添加关键词..." />
        <button onClick={onAdd} className="rounded-lg px-4 py-2 text-xs font-medium text-white" style={{ background: "var(--accent)" }}>添加</button>
      </div>
      {/* Floating ghost chip following pointer */}
      {ghost && dragId !== null && (
        <div
          className="fixed z-50 inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs pointer-events-none shadow-xl"
          style={{
            left: ghost.x,
            top: ghost.y,
            transform: "translate(-50%, -130%)",
            borderColor: "var(--accent)",
            background: "var(--accent-light)",
            color: "var(--accent)",
          }}
        >
          <span style={{ opacity: 0.4, fontSize: "10px" }}>⠿</span>
          {ghost.name}
        </div>
      )}
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
      await fetch("/api/keywords", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reorder", groupId, orderedIds }) });
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
    <div className="min-h-screen flex flex-col md:flex-row" style={{ background: "var(--bg-primary)" }}>      {/* ─── Mobile Top Nav ─── */}
      <div className="flex md:hidden shrink-0 overflow-x-auto border-b" style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
        <div className="flex items-center gap-1 px-3 py-2 shrink-0">
          <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>⚙️ 后台</span>
        </div>
        {MENU_ITEMS.map(item => (
          <button key={item.key} onClick={() => { setMenuKey(item.key); setMsg(""); if (item.key === "history") loadHistory(); if (item.key === "keywords") loadKeywords(); }}
            className="shrink-0 px-4 py-2 text-xs font-medium transition whitespace-nowrap"
            style={{ color: menuKey === item.key ? "var(--accent)" : "var(--text-secondary)", borderBottom: menuKey === item.key ? "2px solid var(--accent)" : "2px solid transparent" }}>
            {item.icon} {item.label}
          </button>
        ))}
        <button onClick={() => router.push("/")} className="shrink-0 px-4 py-2 text-xs text-[var(--text-muted)] whitespace-nowrap">← 返回</button>
      </div>

      {/* ─── Left Sidebar ─── */}
      <aside className="hidden md:flex w-64 shrink-0 border-r flex flex-col" style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
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
        <div className="w-full p-6 md:p-8">
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
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>生成历史</h2>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>共 {history.length} 条记录</p>
                </div>
                <button onClick={loadHistory} className="rounded-lg border px-3 py-1.5 text-xs font-medium" style={{ borderColor: "var(--border)", color: "var(--text-secondary)", background: "var(--bg-tertiary)" }}>刷新</button>
              </div>
              {historyLoading ? (
                <div className="flex items-center justify-center py-12"><div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: "var(--border)", borderTopColor: "var(--accent)" }} /></div>
              ) : history.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2"><span className="text-2xl opacity-30">🖼️</span><p className="text-xs" style={{ color: "var(--text-muted)" }}>暂无生成记录</p></div>
              ) : (
                <div className="space-y-2">
                  {history.map(h => (
                    <div key={h.id} className="flex gap-3 rounded-lg border p-3 transition-all hover:shadow-sm" style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
                      {/* Thumbnail */}
                      <div className="shrink-0 w-16 h-16 rounded-md overflow-hidden bg-[var(--bg-tertiary)] cursor-pointer" onClick={() => window.open(h.imagePath, "_blank")}>
                        {h.imagePath ? (
                          <img src={h.imagePath} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; (e.target as HTMLImageElement).parentElement!.innerHTML = "<span style='font-size:20px;display:flex;align-items:center;justify-content:center;height:100%'>🖼</span>"; }} />
                        ) : (
                          <div className="flex items-center justify-center h-full text-lg opacity-40">🖼</div>
                        )}
                      </div>
                      {/* Details */}
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: h.type === "video" ? "var(--accent-light)" : "rgba(34,197,94,0.12)", color: h.type === "video" ? "var(--accent)" : "rgb(34,197,94)" }}>{h.type || "img"}</span>
                          {h.size && <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{h.size}</span>}
                          <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{new Date(h.createdAt).toLocaleString("zh-CN")}</span>
                        </div>
                        <p className="text-xs leading-relaxed line-clamp-1" style={{ color: "var(--text-secondary)" }} title={h.prompt || h.keywordNames}>{h.prompt || h.keywordNames || "（无描述）"}</p>
                        <div className="flex items-center gap-3 text-[10px]" style={{ color: "var(--text-muted)" }}>
                          {h.keywordNames && h.prompt !== h.keywordNames && <span className="truncate max-w-[200px]">关键词: {h.keywordNames}</span>}
                          <a href={h.imagePath} target="_blank" style={{ color: "var(--accent)" }}>查看原图</a>
                          <button onClick={() => deleteHistory(h.id)} style={{ color: "var(--danger)" }}>删除</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
