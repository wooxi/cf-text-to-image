"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ImageRecord, KeywordGroup, TaskRecord } from "@/types";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
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

const NAV: { key: PanelKey; label: string; icon: string; hint: string }[] = [
  {
    key: "create",
    label: "创作台",
    icon: "✨",
    hint: "选词 · 写提示词 · 提交",
  },
  { key: "gallery", label: "图库", icon: "🖼️", hint: "已生成的作品" },
  { key: "tasks", label: "任务", icon: "📋", hint: "进行中与失败的任务" },
  { key: "settings", label: "设置", icon: "⚙️", hint: "状态 · 关键词 · 历史" },
];

/** 轮询只关心「还没落定」的任务：成功的会进入图库，失败的要留在列表里供重试。 */
const POLLED_STATUSES = ["pending", "processing", "failed"];
const POLL_INTERVAL_MS = 3000;
const HISTORY_PAGE_SIZE = 30;

export default function HomePage() {
  const { authenticated, ready } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  const [panel, setPanel] = useState<PanelKey>("create");
  const [groups, setGroups] = useState<KeywordGroup[]>([]);
  const [prompt, setPrompt] = useState("");

  const [records, setRecords] = useState<ImageRecord[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [nextBefore, setNextBefore] = useState<number | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

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
      <div className="flex min-h-screen items-center justify-center">
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
    gallery: records.length,
    tasks: activeCount + failedCount,
    settings: 0,
  };

  const openRecord = (record: ImageRecord) =>
    setViewerIndex(records.indexOf(record));

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Header onOpenSettings={() => setPanel("settings")} />

      <div className="flex min-h-0 flex-1">
        <aside
          className="hidden w-[200px] shrink-0 flex-col gap-1 overflow-y-auto border-r p-3 lg:flex"
          style={{ borderColor: "var(--border)" }}
        >
          {NAV.map((item) => {
            const active = panel === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setPanel(item.key)}
                className="rounded-lg px-3 py-2.5 text-left transition-base"
                style={{
                  background: active ? "var(--accent-light)" : "transparent",
                  borderLeft: active
                    ? "2px solid var(--accent)"
                    : "2px solid transparent",
                }}
              >
                <div
                  className="flex items-center justify-between gap-2 text-sm font-medium"
                  style={{
                    color: active ? "var(--accent)" : "var(--text-secondary)",
                  }}
                >
                  <span>
                    <span className="mr-2" aria-hidden>
                      {item.icon}
                    </span>
                    {item.label}
                  </span>
                  {counts[item.key] > 0 && (
                    <span className="text-[10px] tabular-nums opacity-70">
                      {counts[item.key]}
                    </span>
                  )}
                </div>
                <div
                  className="mt-0.5 text-[11px] leading-snug"
                  style={{ color: "var(--text-muted)" }}
                >
                  {item.hint}
                </div>
              </button>
            );
          })}

          <div
            className="mt-3 rounded-lg border p-3"
            style={{
              borderColor: "var(--border)",
              background: "var(--bg-secondary)",
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
                ["成品", records.length, "var(--text-secondary)"],
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
        </aside>

        <main className="flex min-h-0 min-w-0 flex-1 flex-col pb-16 lg:pb-0">
          {panel === "create" && (
            <CreatePanel
              groups={groups}
              prompt={prompt}
              onPromptChange={setPrompt}
              onSubmitted={onSubmitted}
            />
          )}

          {panel === "gallery" && (
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
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
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <TasksPanel
                tasks={tasks}
                onRetry={retryTask}
                onDelete={deleteTask}
              />
            </div>
          )}

          {panel === "settings" && (
            <SettingsPanel groups={groups} reloadGroups={loadGroups} />
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
              <span className="text-lg leading-none" aria-hidden>
                {item.icon}
              </span>
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
