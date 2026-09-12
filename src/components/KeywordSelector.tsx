"use client";

import { useMemo, useState } from "react";
import type { KeywordGroup } from "@/types";

interface Props {
  groups: KeywordGroup[];
  selected: string[];
  onToggle: (keyword: string, group: KeywordGroup) => void;
  onClearGroup: (group: KeywordGroup) => void;
  onClearAll: () => void;
}

const CHIP_BASE =
  "rounded-md border px-3 py-1.5 text-sm font-medium transition-base";

function chipStyle(active: boolean): React.CSSProperties {
  return {
    background: active ? "var(--accent-light)" : "var(--bg-secondary)",
    borderColor: active ? "var(--accent)" : "var(--border)",
    color: active ? "var(--accent)" : "var(--text-secondary)",
  };
}

export default function KeywordSelector({
  groups,
  selected,
  onToggle,
  onClearGroup,
  onClearAll,
}: Props) {
  const [query, setQuery] = useState("");
  const [selectedOnly, setSelectedOnly] = useState(false);

  const normalized = query.trim().toLowerCase();

  const visibleGroups = useMemo(() => {
    return groups.map((group) => ({
      group,
      keywords: group.keywords.filter((kw) => {
        if (selectedOnly && !selected.includes(kw.name)) return false;
        return !normalized || kw.name.toLowerCase().includes(normalized);
      }),
    }));
  }, [groups, normalized, selected, selectedOnly]);

  const hasAnyKeyword = groups.some((g) => g.keywords.length > 0);

  if (!hasAnyKeyword) {
    return (
      <div
        className="rounded-lg border border-dashed px-6 py-12 text-center text-sm"
        style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
      >
        <p>还没有任何关键词。</p>
        <p className="mt-1.5 text-xs">
          打开右上角「设置 → 关键词」，新建分组并把词条加进去。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 吸顶：滚动浏览关键词时搜索/已选状态始终可见 */}
      <div
        className="sticky top-0 z-10 -mt-1 flex flex-wrap items-center gap-2 pb-2 pt-1 backdrop-blur-sm"
        style={{ background: "var(--bg-primary)" }}
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索关键词…"
          aria-label="搜索关键词"
          className="min-w-[160px] flex-1 rounded-md border px-3 py-2 text-sm outline-none transition-base focus:border-[var(--border-hover)]"
          style={{
            borderColor: "var(--border)",
            background: "var(--bg-tertiary)",
            color: "var(--text-primary)",
          }}
        />
        <span
          className="text-[11px] tabular-nums"
          style={{ color: "var(--text-muted)" }}
        >
          {selected.length} 已选
        </span>
        <button
          type="button"
          onClick={() => setSelectedOnly((v) => !v)}
          className="rounded-md border px-3 py-1.5 text-xs transition-base hover:border-[var(--border-hover)]"
          style={{
            borderColor: "var(--border)",
            color: "var(--text-secondary)",
          }}
        >
          {selectedOnly ? "显示全部" : "仅看已选"}
        </button>
        {selected.length > 0 && (
          <button
            type="button"
            onClick={onClearAll}
            className="rounded-md border px-3 py-1.5 text-xs transition-base hover:border-[var(--danger)] hover:text-[var(--danger)]"
            style={{
              borderColor: "var(--border)",
              color: "var(--text-secondary)",
            }}
          >
            清空
          </button>
        )}
      </div>

      {/* 宽屏走多列：7 个分组竖排要滚很久，分列后一屏基本能看全 */}
      <div className="columns-1 gap-x-7 md:columns-2 lg:columns-1 xl:columns-2 2xl:columns-3">
      {visibleGroups.map(({ group, keywords }) => {
        const selectedInGroup = group.keywords.filter((kw) =>
          selected.includes(kw.name),
        ).length;
        if (keywords.length === 0 && (normalized || selectedOnly)) return null;

        return (
          <section key={group.id} className="mb-5 break-inside-avoid">
            <div
              className="mb-2.5 flex items-baseline justify-between gap-3 border-b pb-2"
              style={{ borderColor: "var(--border)" }}
            >
              <div className="flex items-baseline gap-2">
                <h3
                  className="text-sm font-semibold"
                  style={{ color: "var(--text-primary)" }}
                >
                  {group.name}
                  {group.isParameterGroup && (
                    <span
                      className="ml-2 rounded-full px-2 py-0.5 text-[10px] font-normal"
                      style={{
                        background: "var(--bg-tertiary)",
                        color: "var(--text-muted)",
                      }}
                    >
                      参数
                    </span>
                  )}
                </h3>
                {group.description && (
                  <span
                    className="hidden text-xs sm:inline"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {group.description}
                  </span>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span
                  className="text-xs tabular-nums"
                  style={{ color: "var(--text-muted)" }}
                >
                  {selectedInGroup} 选
                </span>
                {selectedInGroup > 0 && (
                  <button
                    type="button"
                    onClick={() => onClearGroup(group)}
                    className="text-xs transition-base hover:text-[var(--danger)]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    清空
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {keywords.map((kw) => (
                <button
                  key={kw.id}
                  type="button"
                  aria-pressed={selected.includes(kw.name)}
                  onClick={() => onToggle(kw.name, group)}
                  className={CHIP_BASE}
                  style={chipStyle(selected.includes(kw.name))}
                >
                  {kw.name}
                </button>
              ))}
              {keywords.length === 0 && (
                <span
                  className="text-xs"
                  style={{ color: "var(--text-muted)" }}
                >
                  该分组暂无关键词
                </span>
              )}
            </div>
          </section>
        );
      })}
      </div>
    </div>
  );
}
