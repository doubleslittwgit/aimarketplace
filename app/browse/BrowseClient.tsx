"use client";

import { useMemo, useState } from "react";
import ToolCard from "@/components/ToolCard";
import { categories, type Tool } from "@/lib/mock-data";

type SortKey = "new" | "popular" | "price_asc" | "price_desc";

export default function BrowseClient({
  initialTools,
  initialQuery = "",
  initialCategory = "すべて",
}: {
  initialTools: Tool[];
  initialQuery?: string;
  initialCategory?: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  // ヘッダーの検索から /browse?q=... に遷移してきた場合に入力欄を追随させる。
  // useEffectでの同期は再レンダーが連鎖するため、レンダー中に調整する。
  const [syncedQuery, setSyncedQuery] = useState(initialQuery);
  if (initialQuery !== syncedQuery) {
    setSyncedQuery(initialQuery);
    setQuery(initialQuery);
  }
  const [activeCategory, setActiveCategory] = useState<string>(initialCategory);
  // 商品詳細ページのカテゴリタグから /browse?category=... に遷移してきた場合も同様に追随させる
  const [syncedCategory, setSyncedCategory] = useState(initialCategory);
  if (initialCategory !== syncedCategory) {
    setSyncedCategory(initialCategory);
    setActiveCategory(initialCategory);
  }
  const [sort, setSort] = useState<SortKey>("new");

  const filtered = useMemo(() => {
    let result = initialTools.filter((t) => {
      const matchesQuery =
        query.trim() === "" ||
        t.name.toLowerCase().includes(query.toLowerCase()) ||
        t.tagline.toLowerCase().includes(query.toLowerCase()) ||
        t.tags.some((tag) => tag.toLowerCase().includes(query.toLowerCase()));
      const matchesCategory =
        activeCategory === "すべて" || t.categories.includes(activeCategory);
      return matchesQuery && matchesCategory;
    });

    switch (sort) {
      case "popular":
        result = [...result].sort((a, b) => b.installs - a.installs);
        break;
      case "price_asc":
        result = [...result].sort((a, b) => a.price - b.price);
        break;
      case "price_desc":
        result = [...result].sort((a, b) => b.price - a.price);
        break;
      default:
        result = [...result].sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
    }
    return result;
  }, [initialTools, query, activeCategory, sort]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <h1 className="mb-1 font-display text-2xl font-semibold text-text-primary">
        ツールを探す
      </h1>
      <p className="mb-6 text-[13px] text-text-muted">
        {filtered.length}件のツールが見つかりました
      </p>

      {/* Search input (page-local, in addition to header search) */}
      <div className="mb-5 flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2.5 sm:max-w-md">
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="shrink-0 text-text-muted"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="キーワードで検索..."
          className="w-full bg-transparent font-mono text-[13px] outline-none placeholder:text-text-dim"
        />
      </div>

      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        {/* Category pills */}
        <div className="flex flex-wrap gap-2">
          <CategoryPill
            label="すべて"
            active={activeCategory === "すべて"}
            onClick={() => setActiveCategory("すべて")}
          />
          {categories.map((c) => (
            <CategoryPill
              key={c}
              label={c}
              active={activeCategory === c}
              onClick={() => setActiveCategory(c)}
            />
          ))}
        </div>

        {/* Sort */}
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-[13px] text-text-secondary outline-none"
        >
          <option value="new">新着順</option>
          <option value="popular">人気順</option>
          <option value="price_asc">価格が低い順</option>
          <option value="price_desc">価格が高い順</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
          <p className="mb-1 text-[14px] font-medium text-text-secondary">
            該当するツールが見つかりませんでした
          </p>
          <p className="text-[13px] text-text-muted">
            キーワードやカテゴリを変えて、もう一度お試しください
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((tool) => (
            <ToolCard key={tool.id} tool={tool} />
          ))}
        </div>
      )}
    </div>
  );
}

function CategoryPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 whitespace-nowrap rounded-full border px-4 py-1.5 text-[13px] transition ${
        active
          ? "border-accent-signal/40 bg-accent-signal-dim text-accent-signal"
          : "border-border text-text-secondary hover:border-border-strong hover:text-text-primary"
      }`}
    >
      {label}
    </button>
  );
}
