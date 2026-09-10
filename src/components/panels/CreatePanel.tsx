"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { Keyword, KeywordGroup, TaskType } from "@/types";
import { api, ApiError } from "@/lib/api";
import { resolveSize } from "@/lib/sizes";
import KeywordSelector from "../KeywordSelector";
import ImageUploader from "../ImageUploader";
import { useToast } from "../Toast";

interface Props {
  groups: KeywordGroup[];
  prompt: string;
  onPromptChange: (value: string) => void;
  /** 提交成功：让父级立即刷新任务列表 */
  onSubmitted: () => void;
}

const RATIO = /^\d+:\d+$/;
const TIER = /^\d+$/;

export default function CreatePanel({
  groups,
  prompt,
  onPromptChange,
  onSubmitted,
}: Props) {
  const toast = useToast();
  const [type, setType] = useState<TaskType>("image");
  const [selected, setSelected] = useState<string[]>([]);
  const [refImages, setRefImages] = useState<string[]>([]);
  const [busy, setBusy] = useState<"prompt" | "polish" | "submit" | null>(null);
  const lock = useRef(false);

  const parameterGroups = useMemo(
    () => groups.filter((group) => group.isParameterGroup),
    [groups],
  );

  /** 输出参数里比例只能选一个、清晰度只能选一个 */
  const toggle = useCallback((keyword: string, group: KeywordGroup) => {
    if (!group.isParameterGroup) {
      setSelected((prev) =>
        prev.includes(keyword)
          ? prev.filter((k) => k !== keyword)
          : [...prev, keyword],
      );
      return;
    }
    const sameKind = RATIO.test(keyword) ? RATIO : TIER;
    const inGroup = new Set(group.keywords.map((item: Keyword) => item.name));
    setSelected((prev) => [
      ...prev.filter(
        (k) => !(inGroup.has(k) && sameKind.test(k)) && k !== keyword,
      ),
      keyword,
    ]);
  }, []);

  const { semantic, output } = useMemo(() => {
    const outputNames = new Set(
      parameterGroups.flatMap((group) =>
        group.keywords.map((item) => item.name),
      ),
    );
    const semanticKeywords: string[] = [];
    const outputKeywords: string[] = [];
    for (const name of selected)
      (outputNames.has(name) ? outputKeywords : semanticKeywords).push(name);
    return { semantic: semanticKeywords, output: outputKeywords };
  }, [parameterGroups, selected]);

  const size = resolveSize(selected);

  const runLlm = useCallback(
    async (kind: "prompt" | "polish") => {
      if (lock.current) return;
      if (kind === "prompt" && semantic.length === 0) {
        toast.error("请至少选择一个主体或画面关键词");
        return;
      }
      if (kind === "polish" && !prompt.trim()) {
        toast.error("请先输入内容");
        return;
      }

      lock.current = true;
      setBusy(kind);
      try {
        const result =
          kind === "prompt"
            ? await api.generatePrompt(semantic.map((name) => ({ name })))
            : await api.polish(prompt);
        onPromptChange("prompt" in result ? result.prompt : result.text);
      } catch (e) {
        toast.error(e instanceof ApiError ? e.message : "操作失败");
      } finally {
        lock.current = false;
        setBusy(null);
      }
    },
    [onPromptChange, prompt, semantic, toast],
  );

  const canSubmit =
    type === "img2img"
      ? refImages.length > 0
      : Boolean(prompt.trim() || semantic.length > 0);

  const submit = useCallback(async () => {
    if (lock.current || !canSubmit) return;
    lock.current = true;
    setBusy("submit");
    try {
      await api.tasks.create({
        type,
        prompt: prompt.trim(),
        keywords: semantic.join(", "),
        size,
        image: type === "img2img" ? refImages : undefined,
      });
      toast.success("已提交，正在后台生成");
      onSubmitted();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "提交失败");
    } finally {
      lock.current = false;
      setBusy(null);
    }
  }, [canSubmit, onSubmitted, prompt, refImages, semantic, size, toast, type]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
        <div
          className="flex gap-1 rounded-xl p-1"
          style={{ background: "var(--bg-tertiary)" }}
        >
          {(
            [
              ["image", "🎨 关键词生图"],
              ["img2img", "🖼️ 参考图编辑"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setType(key)}
              className="flex-1 rounded-lg py-2 text-xs font-medium transition-base sm:text-sm"
              style={{
                background: type === key ? "var(--accent)" : "transparent",
                color: type === key ? "#fff" : "var(--text-secondary)",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {type === "img2img" && (
          <section
            className="rounded-xl border p-4"
            style={{
              borderColor: "var(--border)",
              background: "var(--bg-secondary)",
            }}
          >
            <div className="mb-3 flex items-center justify-between">
              <span
                className="text-sm font-medium"
                style={{ color: "var(--text-secondary)" }}
              >
                参考图
              </span>
              <span
                className="text-xs tabular-nums"
                style={{ color: "var(--text-muted)" }}
              >
                {refImages.length}/3
              </span>
            </div>
            <ImageUploader images={refImages} onChange={setRefImages} />
          </section>
        )}

        <KeywordSelector
          groups={groups}
          selected={selected}
          onToggle={toggle}
          onClearGroup={(group) => {
            const names = new Set(group.keywords.map((item) => item.name));
            setSelected((prev) => prev.filter((name) => !names.has(name)));
          }}
          onClearAll={() => setSelected([])}
        />
      </div>

      <div
        className="shrink-0 border-t p-4 backdrop-blur-xl"
        style={{
          borderColor: "var(--border)",
          background: "var(--bg-elevated, var(--bg-secondary))",
        }}
      >
        <div className="space-y-3">
          <textarea
            value={prompt}
            onChange={(event) => onPromptChange(event.target.value)}
            rows={3}
            placeholder={
              type === "img2img"
                ? "描述要保留什么、改动什么，例如：把外套换成红色，背景改为雨天街景…"
                : "选好关键词后点「生成提示词」获取底稿，也可以直接手写画面描述…"
            }
            className="w-full resize-none rounded-md border px-4 py-3 text-sm leading-relaxed outline-none transition-base focus:border-[var(--accent)]"
            style={{
              borderColor: "var(--border)",
              background: "var(--bg-tertiary)",
              color: "var(--text-primary)",
            }}
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div
              className="flex flex-wrap items-center gap-3 text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              <span className="tabular-nums">{prompt.length} 字</span>
              <span className="tabular-nums">
                {size}
                {output.length ? ` · ${output.join(" · ")}` : ""}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {type === "image" && (
                <button
                  type="button"
                  onClick={() => void runLlm("prompt")}
                  disabled={busy !== null || semantic.length === 0}
                  className="rounded-md border px-4 py-2 text-xs font-medium transition-base hover:border-[var(--border-hover)] disabled:cursor-not-allowed disabled:opacity-40"
                  style={{
                    borderColor: "var(--border)",
                    color: "var(--text-secondary)",
                  }}
                >
                  {busy === "prompt" ? "生成中…" : "生成提示词"}
                </button>
              )}
              <button
                type="button"
                onClick={() => void runLlm("polish")}
                disabled={busy !== null || !prompt.trim()}
                className="rounded-md border px-3 py-2 text-xs font-medium transition-base hover:border-[var(--border-hover)] disabled:cursor-not-allowed disabled:opacity-40"
                style={{
                  borderColor: "var(--border)",
                  color: "var(--text-secondary)",
                }}
              >
                {busy === "polish" ? "润色中…" : "AI 润色"}
              </button>
              <button
                type="button"
                onClick={() => void submit()}
                disabled={busy !== null || !canSubmit}
                className="rounded-md px-5 py-2 text-xs font-semibold transition-base disabled:cursor-not-allowed"
                style={{
                  background:
                    canSubmit && busy === null
                      ? "var(--accent)"
                      : "var(--bg-tertiary)",
                  color:
                    canSubmit && busy === null ? "#fff" : "var(--text-muted)",
                }}
              >
                {busy === "submit" ? "提交中…" : "✨ 提交生成"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
