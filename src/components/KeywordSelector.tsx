"use client";

import { useMemo, useState } from "react";
import { Keyword, KeywordGroup } from "@/types";

interface Props {
  groups: KeywordGroup[];
  selected: string[];
  onToggle: (keyword: string) => void;
  onClear?: () => void;
}

function keywordMatchesQuery(keyword: Keyword, normalizedQuery: string) {
  return !normalizedQuery || keyword.name.toLowerCase().includes(normalizedQuery);
}

export default function KeywordSelector({ groups, selected, onToggle, onClear }: Props) {
  const [query, setQuery] = useState("");
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);

  const normalizedQuery = query.trim().toLowerCase();

  const filteredGroups = useMemo(() => {
    return groups
      .filter((group) => !group.parameterGroup)
      .map((group) => {
        const allKeywords = (group.facets || []).flatMap((f) => f.keywords).filter((kw) => {
          if (showSelectedOnly && !selected.includes(kw.name)) return false;
          return keywordMatchesQuery(kw, normalizedQuery);
        });
        return { ...group, flattenedKeywords: allKeywords };
      })
      .filter((group) => group.flattenedKeywords.length > 0 || (!normalizedQuery && !showSelectedOnly));
  }, [groups, normalizedQuery, selected, showSelectedOnly]);

  const parameterGroups = groups.filter((group) => group.parameterGroup);
  const parameterKeywords = useMemo(() => {
    return parameterGroups.flatMap((group) =>
      (group.facets || []).flatMap((f) =>
        f.keywords.filter((kw) => {
          if (showSelectedOnly && !selected.includes(kw.name)) return false;
          return keywordMatchesQuery(kw, normalizedQuery);
        }),
      ),
    );
  }, [parameterGroups, normalizedQuery, selected, showSelectedOnly]);

  const totalSelected = selected.length;

  return (
    <div className="space-y-6">
      {/* Search bar */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索关键词..."
          className="flex-1 min-w-[160px] rounded-md border border-app-border/60 bg-[var(--bg-tertiary)] px-3 py-2 text-sm text-app-text placeholder:text-app-text3 focus:border-[var(--border-hover)] focus:outline-none"
        />
        <span className="text-[11px] text-app-text3 tabular-nums">{groups.length} 组</span>
        <span className="text-[11px] text-app-text3 tabular-nums">{totalSelected} 已选</span>
        <button
          type="button"
          onClick={() => setShowSelectedOnly((prev) => !prev)}
          className="rounded-md border border-app-border/60 px-3 py-1.5 text-xs text-app-text3 transition-base hover:border-[var(--border-hover)] hover:text-app-text2"
        >
          {showSelectedOnly ? "全部" : "仅看已选"}
        </button>
        {totalSelected > 0 && onClear && (
          <button
            type="button"
            onClick={onClear}
            className="rounded-md border border-app-border/60 px-3 py-1.5 text-xs text-app-text3 transition-base hover:border-[var(--danger)] hover:text-[var(--danger)]"
          >
            清空
          </button>
        )}
      </div>

      {/* One row per group — flat chips, no facets */}
      {filteredGroups.length > 0 && (
        <div className="flex flex-col gap-6">
          {filteredGroups.map((group) => {
            const groupSelected = group.flattenedKeywords.filter((kw) => selected.includes(kw.name)).length;

            return (
              <div key={group.id}>
                <div className="flex items-baseline justify-between gap-3 pb-2 mb-3 border-b border-app-border/40">
                  <div className="flex items-baseline gap-2">
                    <h3 className="text-lg font-semibold text-app-text">{group.name}</h3>
                    {group.description && (
                      <span className="text-xs text-app-text3 hidden sm:inline">{group.description}</span>
                    )}
                  </div>
                  <span className="text-xs tabular-nums text-app-text3 shrink-0">{groupSelected} 选</span>
                </div>

                <div className="flex flex-wrap gap-2.5">
                  {group.flattenedKeywords.map((kw) => {
                    const active = selected.includes(kw.name);
                    return (
                      <button
                        key={kw.id}
                        type="button"
                        onClick={() => onToggle(kw.name)}
                        className="rounded-md border px-3 py-1.5 text-sm font-medium transition-base"
                        style={{
                          background: active ? "var(--accent-light)" : "rgba(255,255,255,0.03)",
                          borderColor: active ? "var(--accent)" : "var(--border)",
                          color: active ? "var(--accent)" : "var(--text-secondary)",
                        }}
                      >
                        {kw.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Parameter groups — flat chips row */}
      {parameterKeywords.length > 0 && (
        <div>
          <div className="flex items-baseline justify-between gap-3 pb-2 mb-3 border-b border-app-border/40">
            <div className="flex items-baseline gap-2">
              <h3 className="text-lg font-semibold text-app-text2">输出参数</h3>
              <span className="text-xs text-app-text3">比例与清晰度，不参与语义推理</span>
            </div>
            <span className="text-xs tabular-nums text-app-text3 shrink-0">
              {parameterKeywords.filter((kw) => selected.includes(kw.name)).length} 选
            </span>
          </div>

          <div className="flex flex-wrap gap-2.5">
            {parameterKeywords.map((kw) => {
              const active = selected.includes(kw.name);
              return (
                <button
                  key={kw.id}
                  type="button"
                  onClick={() => onToggle(kw.name)}
                  className="rounded-md border px-3 py-1.5 text-sm font-medium transition-base"
                  style={{
                    background: active ? "var(--accent-light)" : "rgba(255,255,255,0.03)",
                    borderColor: active ? "var(--accent)" : "var(--border)",
                    color: active ? "var(--accent)" : "var(--text-secondary)",
                  }}
                >
                  {kw.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {filteredGroups.length === 0 && parameterKeywords.length === 0 && (
        <div className="rounded-lg border border-dashed border-app-border/40 px-6 py-12 text-center text-sm text-app-text3">
          {groups.length === 0 ? "正在加载关键词..." : "没有匹配到关键词，换个词试试。"}
        </div>
      )}
    </div>
  );
}
