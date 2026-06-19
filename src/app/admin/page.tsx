"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface ConfigMap {
  [key: string]: string;
}

const CONFIG_LABELS: Record<string, string> = {
  llm_endpoint: "LLM 端点",
  llm_model: "LLM 模型",
  image_endpoint: "图像端点",
  image_model: "图像模型",
  video_endpoint: "视频端点",
  video_model: "视频模型",
  enable_registration: "开放注册",
};

// Map model fields to their corresponding endpoint fields
const MODEL_TO_ENDPOINT: Record<string, string> = {
  llm_model: "llm_endpoint",
  image_model: "image_endpoint",
  video_model: "video_endpoint",
};

const SECRET_LABELS: Record<string, string> = {
  llm_api_key: "LLM API Key",
  image_api_key: "图像 API Key",
  video_api_key: "视频 API Key",
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
  const [formRef, setFormRef] = useState<HTMLFormElement | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setUser(data.data);
        loadConfig();
      } else {
        setLoading(false);
      }
    } catch {
      setLoading(false);
    }
  }

  async function loadConfig() {
    try {
      const res = await fetch("/api/config");
      if (res.ok) {
        const data = await res.json();
        setConfig(data.data || {});
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: form.get("username"),
          password: form.get("password"),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.data);
        await loadConfig();
      } else {
        const err = await res.json();
        setMessage(err.error || "登录失败");
      }
    } catch {
      setMessage("网络错误");
    }
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    const form = new FormData(e.currentTarget);
    const updates: Record<string, string> = {};
    for (const [key, value] of form.entries()) {
      if (typeof value === "string" && value.trim()) {
        updates[key] = value.trim();
      }
    }
    try {
      const res = await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        setMessage("保存成功");
        await loadConfig();
      } else {
        const err = await res.json();
        setMessage(err.error || "保存失败");
      }
    } catch {
      setMessage("网络错误");
    }
    setSaving(false);
  }

  async function fetchModels(modelKey: string) {
    const endpointKey = MODEL_TO_ENDPOINT[modelKey];
    if (!endpointKey) return;

    // Get current endpoint value from form
    const endpointInput = document.querySelector(`input[name="${endpointKey}"]`) as HTMLInputElement;
    const endpoint = endpointInput?.value?.trim();
    if (!endpoint) {
      setMessage("请先填写端点地址");
      return;
    }

    setFetchingModel(modelKey);
    setMessage("");

    try {
      const res = await fetch("/api/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint }),
      });
      const data = await res.json();
      if (data.success) {
        setModelLists((prev) => ({ ...prev, [modelKey]: data.data }));
        setModelDropdown(modelKey);
        setMessage(`找到 ${data.data.length} 个模型`);
      } else {
        setMessage(data.error || "获取失败");
      }
    } catch {
      setMessage("网络错误");
    }
    setFetchingModel(null);
  }

  function selectModel(modelKey: string, modelName: string) {
    const input = document.querySelector(`input[name="${modelKey}"]`) as HTMLInputElement;
    if (input) {
      input.value = modelName;
      // Trigger change event for React controlled input
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, "value"
      )?.set;
      nativeInputValueSetter?.call(input, modelName);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
    setModelDropdown(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: "var(--border)", borderTopColor: "var(--accent)" }} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-16">
        <h1 className="text-2xl font-bold mb-8 text-center" style={{ color: "var(--text-primary)" }}>
          后台管理
        </h1>
        <form onSubmit={handleLogin} className="rounded-2xl border p-6" style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>用户名</label>
            <input
              name="username"
              type="text"
              required
              className="w-full rounded-lg border px-3 py-2.5 text-sm transition-colors"
              style={{ borderColor: "var(--border)", background: "var(--bg-tertiary)", color: "var(--text-primary)" }}
              placeholder="admin"
            />
          </div>
          <div className="mb-6">
            <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>密码</label>
            <input
              name="password"
              type="password"
              required
              className="w-full rounded-lg border px-3 py-2.5 text-sm transition-colors"
              style={{ borderColor: "var(--border)", background: "var(--bg-tertiary)", color: "var(--text-primary)" }}
              placeholder="••••••"
            />
          </div>
          {message && (
            <p className="text-sm mb-4 text-center" style={{ color: "var(--danger)" }}>{message}</p>
          )}
          <button
            type="submit"
            className="w-full rounded-lg py-2.5 text-sm font-medium text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{ background: "var(--accent)" }}
          >
            登录
          </button>
        </form>
      </div>
    );
  }

  const modelFields = ["llm_model", "image_model", "video_model"];

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>后台管理</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            已登录：{user.username}
          </p>
        </div>
        <button
          onClick={() => router.push("/")}
          className="rounded-full border px-4 py-2 text-sm font-medium transition-all hover:scale-[1.02]"
          style={{ borderColor: "var(--border)", color: "var(--text-secondary)", background: "var(--bg-secondary)" }}
        >
          ← 返回创作台
        </button>
      </div>

      {/* Config Form */}
      <form onSubmit={handleSave} ref={setFormRef} className="rounded-2xl border p-6 mb-6" style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
        <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--text-primary)" }}>端点配置</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {Object.entries(CONFIG_LABELS).map(([key, label]) => {
            const isModelField = modelFields.includes(key);
            return (
              <div key={key}>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>{label}</label>
                <div className="flex gap-1.5">
                  <input
                    name={key}
                    type="text"
                    defaultValue={config[key] || ""}
                    className="flex-1 rounded-lg border px-3 py-2 text-sm transition-colors"
                    style={{ borderColor: "var(--border)", background: "var(--bg-tertiary)", color: "var(--text-primary)" }}
                    placeholder={key === "enable_registration" ? "true/false" : isModelField ? "gpt-4o" : "https://..."}
                  />
                  {isModelField && (
                    <button
                      type="button"
                      onClick={() => fetchModels(key)}
                      disabled={fetchingModel === key}
                      className="shrink-0 rounded-lg border px-2.5 py-2 text-xs font-medium transition-all hover:scale-[1.02] disabled:opacity-50"
                      style={{ borderColor: "var(--accent)", color: "var(--accent)", background: "var(--accent-light)" }}
                    >
                      {fetchingModel === key ? "..." : "获取"}
                    </button>
                  )}
                </div>
                {/* Model dropdown */}
                {modelDropdown === key && modelLists[key]?.length > 0 && (
                  <div className="mt-1.5 rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)", background: "var(--bg-tertiary)" }}>
                    <div className="max-h-48 overflow-y-auto">
                      {modelLists[key].map((model) => (
                        <button
                          key={model}
                          type="button"
                          onClick={() => selectModel(key, model)}
                          className="w-full text-left px-3 py-1.5 text-xs transition-colors hover:bg-[var(--accent-light)] block"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          {model}
                        </button>
                      ))}
                    </div>
                    <div className="border-t px-2 py-1" style={{ borderColor: "var(--border)" }}>
                      <button
                        type="button"
                        onClick={() => setModelDropdown(null)}
                        className="text-[10px]"
                        style={{ color: "var(--text-muted)" }}
                      >
                        关闭列表
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-6">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg px-6 py-2.5 text-sm font-medium text-white transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
            style={{ background: "var(--accent)" }}
          >
            {saving ? "保存中..." : "保存配置"}
          </button>
        </div>
      </form>

      {/* API Keys Status */}
      <div className="rounded-2xl border p-6 mb-6" style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
        <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--text-primary)" }}>API 密钥</h2>
        <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
          API 密钥存储在 Cloudflare 环境变量中，无法在此查看或修改。请在 CF Dashboard 中配置。
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {Object.entries(SECRET_LABELS).map(([key, label]) => {
            const envKey = key.toUpperCase();
            const status = config[key] || "未知";
            const isSet = status.includes("已设置");
            return (
              <div key={key} className="flex items-center justify-between rounded-lg border px-4 py-3" style={{ borderColor: "var(--border)", background: "var(--bg-tertiary)" }}>
                <div>
                  <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{label}</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>环境变量: {envKey}</p>
                </div>
                <span className="text-xs px-2 py-1 rounded-full font-medium"
                  style={{
                    background: isSet ? "var(--success-bg)" : "var(--danger-bg)",
                    color: isSet ? "var(--success)" : "var(--danger)",
                  }}>
                  {isSet ? "✓ 已设置" : "✗ 未设置"}
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-4 p-4 rounded-lg" style={{ background: "var(--bg-tertiary)" }}>
          <p className="text-xs font-medium mb-2" style={{ color: "var(--text-secondary)" }}>
            如何配置 API 密钥？
          </p>
          <ol className="text-xs space-y-1" style={{ color: "var(--text-muted)" }}>
            <li>1. 打开 <a href="https://dash.cloudflare.com/6db88a1dbe172e4579cd429c822eb598/pages/view/cf-text-to-image/settings/environment-variables" target="_blank" className="underline" style={{ color: "var(--accent)" }}>CF Pages 环境变量设置</a></li>
            <li>2. 添加变量：<code className="px-1 rounded" style={{ background: "var(--border)" }}>LLM_API_KEY</code>、<code className="px-1 rounded" style={{ background: "var(--border)" }}>IMAGE_API_KEY</code>、<code className="px-1 rounded" style={{ background: "var(--border)" }}>VIDEO_API_KEY</code></li>
            <li>3. 勾选「加密」选项保护密钥安全</li>
            <li>4. 保存后重新部署即可生效</li>
          </ol>
        </div>
      </div>

      {message && (
        <div className="text-sm text-center p-3 rounded-lg"
          style={{
            background: message.includes("成功") || message.includes("找到") ? "var(--success-bg)" : "var(--danger-bg)",
            color: message.includes("成功") || message.includes("找到") ? "var(--success)" : "var(--danger)",
          }}>
          {message}
        </div>
      )}
    </div>
  );
}
