"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ImageRecord, KeywordGroup, TaskRecord } from "@/types";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { useTheme } from "@/components/ThemeProvider";
import {
  ChevronDown,
  Images,
  ListTodo,
  LogOut,
  Moon,
  Settings2,
  Sparkles,
  Sun,
} from "lucide-react";
import { useConfirm } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import Gate from "@/components/Gate";
import Header from "@/components/Header";
import Gallery from "@/components/Gallery";
import FullscreenViewer from "@/components/FullscreenViewer";
import CreatePanel from "@/components/panels/CreatePanel";
import TasksPanel from "@/components/panels/TasksPanel";
import SettingsPanel from "@/components/panels/SettingsPanel";

type PanelKey = "create" | "gallery" | "tasks" | "settings";

const NAV: { key: PanelKey; label: string; icon: typeof Sparkles }[] = [
  { key: "create", label: "创作台", icon: Sparkles },
  { key: "gallery", label: "图库", icon: Images },
  { key: "tasks", label: "任务", icon: ListTodo },
  { key: "settings", label: "设置", icon: Settings2 },
];

type SettingsTab = "config" | "keywords" | "history";

const SETTINGS_TABS: { key: SettingsTab; label: string }[] = [
  { key: "config", label: "配置" },
  { key: "keywords", label: "关键词" },
  { key: "history", label: "生成历史" },
];

/** 侧栏树形导航：设置节点可二次展开出它的三个子页 */
function NavTree({
  panel,
  onSelect,
  settingsTab,
  onSettingsTab,
  counts,
}: {
  panel: PanelKey;
  onSelect: (key: PanelKey) => void;
  settingsTab: SettingsTab;
  onSettingsTab: (key: SettingsTab) => void;
  counts: Record<PanelKey, number>;
}) {
  const [open, setOpen] = useState(panel === "settings");
  const settingsActive = panel === "settings";

  const row = (active: boolean) => ({
    className:
      "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium transition-base",
    style: {
      background: active ? "var(--accent-light)" : "transparent",
      color: active ? "var(--accent)" : "var(--text-secondary)",
    },
  });

  return (
    <nav className="flex flex-col gap-0.5">
      {NAV.filter((item) => item.key !== "settings").map((item) => {
        const active = panel === item.key;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onSelect(item.key)}
            aria-current={active ? "page" : undefined}
            {...row(active)}
          >
            <item.icon className="h-4 w-4 shrink-0" aria-hidden />
            {item.label}
            {counts[item.key] > 0 && (
              <span className="ml-auto text-[10px] tabular-nums opacity-70">
                {counts[item.key]}
              </span>
            )}
          </button>
        );
      })}

      <button
        type="button"
        onClick={() => {
          setOpen((value) => !value);
          onSelect("settings");
        }}
        aria-expanded={open}
        {...row(settingsActive)}
      >
        <Settings2 className="h-4 w-4 shrink-0" aria-hidden />
        设置
        <ChevronDown
          className={`ml-auto h-3.5 w-3.5 transition-transform ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden
        />
      </button>

      {open && (
        <div
          className="ml-3 flex flex-col gap-0.5 border-l pl-2.5"
          style={{ borderColor: "var(--border)" }}
        >
          {SETTINGS_TABS.map((item) => {
            const active = settingsActive && settingsTab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  onSelect("settings");
                  onSettingsTab(item.key);
                }}
                aria-current={active ? "page" : undefined}
                className="rounded-md px-2.5 py-1.5 text-left text-xs transition-base"
                style={{
                  background: active ? "var(--accent-light)" : "transparent",
                  color: active ? "var(--accent)" : "var(--text-muted)",
                }}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </nav>
  );
}

/** 轮询只关心「还没落定」的任务：成功的会进入图库，失败的要留在列表里供重试。 */
const POLLED_STATUSES = ["pending", "processing", "failed"];
const POLL_INTERVAL_MS = 3000;
const HISTORY_PAGE_SIZE = 30;

export default function HomePage() {
  const { authenticated, ready, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const toast = useToast();
  const confirm = useConfirm();

  const [panel, setPanel] = useState<PanelKey>("create");
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("config");
  const [groups, setGroups] = useState<KeywordGroup[]>([]);
  const [prompt, setPrompt] = useState("");

  const [records, setRecords] = useState<ImageRecord[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [nextBefore, setNextBefore] = useState<number | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  /** 图库真实总数：分页只拉了一部分，别拿已加载条数冒充总量 */
  const [historyTotal, setHistoryTotal] = useState(0);

  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /** 上一轮的活跃任务数，用来只在「有任务落定」时刷新图库，避免每 3 秒都打一次 D1 */
  const activeRef = useRef(0);

  const report = useCallback(
    (e: unknown, fallback: string) => {
      toast.error(e instanceof ApiError ? e.message : fallback);
    },
    [toast],
  );

  const loadGroups = useCallback(async () => {
    try {
      setGroups(await api.keywords.list());
    } catch (e) {
      report(e, "关键词加载失败");
    }
  }, [report]);

  const loadHistory = useCallback(
    async (before?: number) => {
      setHistoryLoading(true);
      try {
        const page = await api.history.list(HISTORY_PAGE_SIZE, before);
        setRecords((prev) => (before ? [...prev, ...page.items] : page.items));
        setHasMore(page.hasMore);
        setNextBefore(page.nextBefore);
        setHistoryTotal(page.total);
      } catch (e) {
        report(e, "历史加载失败");
      } finally {
        setHistoryLoading(false);
      }
    },
    [report],
  );

  /** 拉一次任务列表，返回仍在处理的条数 */
  const refreshTasks = useCallback(async () => {
    const list = await api.tasks.list(POLLED_STATUSES);
    setTasks(list);
    const active = list.filter(
      (task) => task.status === "pending" || task.status === "processing",
    ).length;
    activeRef.current = active;
    return active;
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    pollRef.current = setInterval(() => {
      void refreshTasks()
        .then(async (active) => {
          if (active === 0) {
            stopPolling();
            await loadHistory();
          }
        })
        .catch(() => stopPolling());
    }, POLL_INTERVAL_MS);
  }, [loadHistory, refreshTasks, stopPolling]);

  useEffect(() => {
    if (!authenticated) {
      stopPolling();
      return;
    }
    void loadGroups();
    void loadHistory();
    void refreshTasks()
      .then((active) => {
        if (active > 0) startPolling();
      })
      .catch((e) => report(e, "任务加载失败"));
    return stopPolling;
  }, [
    authenticated,
    loadGroups,
    loadHistory,
    refreshTasks,
    report,
    startPolling,
    stopPolling,
  ]);

  const onSubmitted = useCallback(() => {
    // 队列里已经有新任务了，立刻拉一次而不是等下一个轮询周期
    void refreshTasks()
      .then(() => startPolling())
      .catch(() => undefined);
  }, [refreshTasks, startPolling]);

  const retryTask = useCallback(
    async (id: number) => {
      try {
        await api.tasks.retry(id);
        await refreshTasks();
        startPolling();
      } catch (e) {
        report(e, "重试失败");
      }
    },
    [refreshTasks, report, startPolling],
  );

  const deleteTask = useCallback(
    async (id: number) => {
      try {
        await api.tasks.remove(id);
        setTasks((prev) => prev.filter((task) => task.id !== id));
      } catch (e) {
        report(e, "删除失败");
      }
    },
    [report],
  );

  const deleteRecord = useCallback(
    async (record: ImageRecord) => {
      const confirmed = await confirm({
        title: "删除这件作品？",
        message: "对应的图片文件会被一并删除，不可撤销。",
        confirmLabel: "删除",
        danger: true,
      });
      if (!confirmed) return;
      try {
        await api.history.remove(record.id);
        setRecords((prev) => prev.filter((item) => item.id !== record.id));
        setViewerIndex(null);
      } catch (e) {
        report(e, "删除失败");
      }
    },
    [confirm, report],
  );

  const { activeCount, failedCount } = useMemo(() => {
    let active = 0;
    let failed = 0;
    for (const task of tasks) {
      if (task.status === "failed") failed++;
      else if (task.status === "pending" || task.status === "processing")
        active++;
    }
    return { activeCount: active, failedCount: failed };
  }, [tasks]);

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div
          className="h-6 w-6 animate-spin rounded-full border-2"
          style={{
            borderColor: "var(--border)",
            borderTopColor: "var(--accent)",
          }}
        />
      </div>
    );
  }

  if (!authenticated) return <Gate />;

  const counts: Record<PanelKey, number> = {
    create: 0,
    gallery: historyTotal,
    tasks: activeCount + failedCount,
    settings: 0,
  };

  const openRecord = (record: ImageRecord) =>
    setViewerIndex(records.indexOf(record));

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <Header onOpenSettings={() => setPanel("settings")} />

      <div className="flex min-h-0 flex-1 gap-3 p-3 lg:gap-4 lg:p-4">
        <aside
          className="hidden w-[248px] shrink-0 flex-col overflow-y-auto rounded-2xl border p-3 lg:flex"
          style={{
            borderColor: "var(--border)",
            background: "var(--bg-secondary)",
          }}
        >
          <div className="mb-3 flex items-center gap-2.5 px-2 pt-1">
            <img src="/icon.svg" alt="" className="h-8 w-8" />
            <div className="min-w-0">
              <div
                className="truncate text-sm font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                文生图工作室
              </div>
              <div
                className="truncate text-[10px] uppercase tracking-[0.18em]"
                style={{ color: "var(--text-muted)" }}
              >
                Text to Image Studio
              </div>
            </div>
          </div>

          <NavTree
            panel={panel}
            onSelect={setPanel}
            settingsTab={settingsTab}
            onSettingsTab={setSettingsTab}
            counts={counts}
          />

          <div className="mt-auto space-y-2 pt-3">
            <div
              className="rounded-lg border p-3"
              style={{
                borderColor: "var(--border)",
                background: "var(--bg-tertiary)",
              }}
            >
            {(
              [
                [
                  "进行中",
                  activeCount,
                  activeCount > 0 ? "var(--accent)" : "var(--text-secondary)",
                ],
                [
                  "失败",
                  failedCount,
                  failedCount > 0 ? "var(--danger)" : "var(--text-secondary)",
                ],
                ["成品", historyTotal, "var(--text-secondary)"],
              ] as const
            ).map(([label, value, color]) => (
              <div
                key={label}
                className="flex justify-between text-xs [&+&]:mt-1.5"
              >
                <span style={{ color: "var(--text-muted)" }}>{label}</span>
                <span className="tabular-nums" style={{ color }}>
                  {value}
                </span>
              </div>
            ))}
            </div>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={toggle}
                title={theme === "dark" ? "切换浅色" : "切换深色"}
                className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border text-xs transition-base hover:border-[var(--border-hover)]"
                style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
              >
                {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                {theme === "dark" ? "浅色" : "深色"}
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
                className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border text-xs transition-base hover:border-[var(--danger)] hover:text-[var(--danger)]"
                style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
              >
                <LogOut className="h-3.5 w-3.5" />
                退出
              </button>
            </div>
          </div>
        </aside>

        <main
          className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border pb-16 lg:pb-0"
          style={{
            borderColor: "var(--border)",
            background: "var(--bg-secondary)",
          }}
        >
          {panel === "create" && (
            <CreatePanel
              groups={groups}
              prompt={prompt}
              onPromptChange={setPrompt}
              onSubmitted={onSubmitted}
            />
          )}

          {panel === "gallery" && (
            <div className="scroll-touch min-h-0 flex-1 overflow-y-auto px-4 py-4 lg:px-6 lg:py-5">
              <Gallery
                records={records}
                liveTasks={tasks}
                loading={historyLoading}
                hasMore={hasMore}
                onLoadMore={() => void loadHistory(nextBefore ?? undefined)}
                onDelete={deleteRecord}
                onDeleteTask={deleteTask}
                onRetryTask={retryTask}
                onOpen={openRecord}
              />
            </div>
          )}

          {panel === "tasks" && (
            <div className="scroll-touch min-h-0 flex-1 overflow-y-auto px-4 py-4 lg:px-6 lg:py-5">
              <TasksPanel
                tasks={tasks}
                onRetry={retryTask}
                onDelete={deleteTask}
              />
            </div>
          )}

          {panel === "settings" && (
            <SettingsPanel
              groups={groups}
              reloadGroups={loadGroups}
              tab={settingsTab}
              onTabChange={setSettingsTab}
            />
          )}
        </main>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex border-t lg:hidden"
        style={{
          borderColor: "var(--border)",
          background: "var(--bg-elevated, var(--bg-secondary))",
          paddingBottom: "max(6px, env(safe-area-inset-bottom))",
        }}
      >
        {NAV.map((item) => {
          const active = panel === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setPanel(item.key)}
              aria-current={active ? "page" : undefined}
              className="relative flex flex-1 flex-col items-center gap-0.5 py-2.5 transition-base"
              style={{ color: active ? "var(--accent)" : "var(--text-muted)" }}
            >
              <item.icon className="h-5 w-5" aria-hidden />
              <span className="text-[10px] font-medium">{item.label}</span>
              {counts[item.key] > 0 && (
                <span
                  className="absolute right-[22%] top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-semibold text-white"
                  style={{
                    background:
                      item.key === "tasks" && failedCount > 0
                        ? "var(--danger)"
                        : "var(--accent)",
                  }}
                >
                  {counts[item.key]}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {viewerIndex !== null && viewerIndex >= 0 && (
        <FullscreenViewer
          records={records}
          activeIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
          onDelete={(record) => void deleteRecord(record)}
        />
      )}
    </div>
  );
}
