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

/**
 * 桌面端左右分栏：左边选关键词（唯一会滚动的区域），右边是固定的创作栏。
 * 移动端退回上下堆叠，创作栏吸在底部——避免提示词框和提交按钮被关键词挤到屏幕外。
 */
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
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      {/* 左栏：顶部固定模式切换，下面才是可滚动的选词区 */}
      <div className="flex min-h-0 flex-1 flex-col">
        <div
          className="shrink-0 border-b px-4 py-3 lg:px-6"
          style={{ borderColor: "var(--border)" }}
        >
          <div
            className="inline-flex gap-1 rounded-lg p-0.5"
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
                className="rounded-[7px] px-4 py-1.5 text-xs font-medium transition-base"
                style={{
                  background: type === key ? "var(--accent)" : "transparent",
                  color: type === key ? "#fff" : "var(--text-secondary)",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="scroll-touch min-h-0 flex-1 overflow-y-auto px-4 py-4 lg:px-6 lg:py-5">
          <div className="mx-auto w-full max-w-4xl space-y-5">
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
        </div>
      </div>

      {/* 右栏：创作区（桌面固定列，移动端吸底） */}
      <section
        className="shrink-0 border-t p-4 lg:w-[380px] lg:border-l lg:border-t-0 xl:w-[420px]"
        style={{
          borderColor: "var(--border)",
          background: "var(--bg-secondary)",
        }}
      >
        <div className="flex h-full flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2
              className="text-xs font-semibold uppercase tracking-[0.14em]"
              style={{ color: "var(--text-muted)" }}
            >
              画面描述
            </h2>
            <span
              className="text-[11px] tabular-nums"
              style={{ color: "var(--text-muted)" }}
            >
              {prompt.length} 字
            </span>
          </div>

          <textarea
            value={prompt}
            onChange={(event) => onPromptChange(event.target.value)}
            rows={type === "img2img" ? 3 : 5}
            placeholder={
              type === "img2img"
                ? "描述要保留什么、改动什么，例如：把外套换成红色，背景改为雨天街景…"
                : "选好关键词后点「生成提示词」获取底稿，也可以直接手写画面描述…"
            }
            className="max-h-[280px] w-full resize-y rounded-lg border px-3.5 py-3 text-sm leading-relaxed outline-none transition-base focus:border-[var(--accent)]"
            style={{
              borderColor: "var(--border)",
              background: "var(--bg-tertiary)",
              color: "var(--text-primary)",
            }}
          />

          <div
            className="flex min-h-[88px] flex-1 flex-col gap-2 overflow-hidden rounded-lg border px-3 py-2.5"
            style={{
              borderColor: "var(--border)",
              background: "var(--bg-tertiary)",
            }}
          >
            <div className="flex shrink-0 items-baseline justify-between">
              <span
                className="text-[10px] uppercase tracking-wider"
                style={{ color: "var(--text-muted)" }}
              >
                已选关键词
              </span>
              <span
                className="text-[10px] tabular-nums"
                style={{ color: "var(--text-muted)" }}
              >
                {selected.length > 0 ? `${selected.length} 个 · 点一下移除` : ""}
              </span>
            </div>
            <div className="scrollbar-thin flex flex-1 flex-wrap content-start gap-1.5 overflow-y-auto">
              {selected.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() =>
                    setSelected((prev) => prev.filter((item) => item !== name))
                  }
                  className="h-fit rounded-md px-2 py-0.5 text-[11px] transition-base hover:opacity-70"
                  style={{
                    background: "var(--accent-light)",
                    color: "var(--accent)",
                  }}
                >
                  {name}
                </button>
              ))}
              {selected.length === 0 && (
                <span
                  className="text-[11px] leading-relaxed"
                  style={{ color: "var(--text-muted)" }}
                >
                  左边点几个词，这里会列出来；出图时用的就是它们加上你写的描述。
                </span>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 text-[11px]">
            <span
              className="badge"
              style={{
                background: "var(--accent-light)",
                color: "var(--accent)",
              }}
            >
              {size}
            </span>
            {output.map((name) => (
              <span
                key={name}
                className="badge"
                style={{
                  background: "var(--bg-tertiary)",
                  color: "var(--text-secondary)",
                }}
              >
                {name}
              </span>
            ))}
          </div>

          <div className="flex shrink-0 flex-col gap-2">
            <button
              type="button"
              onClick={() => void submit()}
              disabled={busy !== null || !canSubmit}
              className="w-full rounded-lg py-2.5 text-sm font-semibold transition-base disabled:cursor-not-allowed"
              style={{
                background:
                  canSubmit && busy === null ? "var(--accent)" : "var(--bg-tertiary)",
                color: canSubmit && busy === null ? "#fff" : "var(--text-muted)",
              }}
            >
              {busy === "submit" ? "提交中…" : "✨ 提交生成"}
            </button>

            <div className="flex gap-2">
              {type === "image" && (
                <button
                  type="button"
                  onClick={() => void runLlm("prompt")}
                  disabled={busy !== null || semantic.length === 0}
                  className="flex-1 rounded-lg border py-2 text-xs font-medium transition-base hover:border-[var(--border-hover)] disabled:cursor-not-allowed disabled:opacity-40"
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
                className="flex-1 rounded-lg border py-2 text-xs font-medium transition-base hover:border-[var(--border-hover)] disabled:cursor-not-allowed disabled:opacity-40"
                style={{
                  borderColor: "var(--border)",
                  color: "var(--text-secondary)",
                }}
              >
                {busy === "polish" ? "润色中…" : "AI 润色"}
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
