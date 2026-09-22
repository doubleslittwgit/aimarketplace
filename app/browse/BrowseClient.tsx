"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import ToolCard from "@/components/ToolCard";
import { categories, type Tool } from "@/lib/mock-data";
import { categoryToSlug, ALL_CATEGORIES_VALUE } from "@/lib/category-slugs";

type SortKey = "new" | "popular" | "price_asc" | "price_desc";

export default function BrowseClient({
  initialTools,
  initialQuery = "",
  initialCategory = ALL_CATEGORIES_VALUE,
}: {
  initialTools: Tool[];
  initialQuery?: string;
  initialCategory?: string;
}) {
  const tBrowse = useTranslations("browse");
  const tCategories = useTranslations("categories");
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
  const [freeOnly, setFreeOnly] = useState(false);

  const filtered = useMemo(() => {
    let result = initialTools.filter((t) => {
      const matchesQuery =
        query.trim() === "" ||
        t.name.toLowerCase().includes(query.toLowerCase()) ||
        t.tagline.toLowerCase().includes(query.toLowerCase()) ||
        t.tags.some((tag) => tag.toLowerCase().includes(query.toLowerCase()));
      const matchesCategory =
        activeCategory === ALL_CATEGORIES_VALUE || t.categories.includes(activeCategory);
      // セール中かどうかに関わらず、通常価格が0のものだけを「無料」とする
      const matchesFree = !freeOnly || t.price === 0;
      return matchesQuery && matchesCategory && matchesFree;
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
  }, [initialTools, query, activeCategory, sort, freeOnly]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <h1 className="mb-1 font-display text-2xl font-semibold text-text-primary">
        {tBrowse("title")}
      </h1>
      <p className="mb-6 text-[13px] text-text-muted">
        {tBrowse("resultsCount", { count: filtered.length })}
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
          placeholder={tBrowse("searchPlaceholder")}
          className="w-full bg-transparent font-mono text-[13px] outline-none placeholder:text-text-dim"
        />
      </div>

      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        {/* Category pills */}
        <div className="flex flex-wrap gap-2">
          <CategoryPill
            label={tBrowse("categoryAll")}
            active={activeCategory === ALL_CATEGORIES_VALUE}
            onClick={() => setActiveCategory(ALL_CATEGORIES_VALUE)}
          />
          {categories.map((c) => (
            <CategoryPill
              key={c}
              label={tCategories(categoryToSlug(c))}
              active={activeCategory === c}
              onClick={() => setActiveCategory(c)}
            />
          ))}
        </div>

        {/* 無料のみ */}
        <button
          type="button"
          onClick={() => setFreeOnly((v) => !v)}
          className={`shrink-0 rounded-lg border px-3 py-2 text-[13px] transition ${
            freeOnly
              ? "border-accent-success/40 bg-accent-success/10 text-accent-success"
              : "border-border bg-surface text-text-secondary hover:border-border-strong"
          }`}
        >
          {tBrowse("freeOnly")}
        </button>

        {/* Sort */}
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-[13px] text-text-secondary outline-none"
        >
          <option value="new">{tBrowse("sortNew")}</option>
          <option value="popular">{tBrowse("sortPopular")}</option>
          <option value="price_asc">{tBrowse("sortPriceAsc")}</option>
          <option value="price_desc">{tBrowse("sortPriceDesc")}</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
          <p className="mb-1 text-[14px] font-medium text-text-secondary">
            {tBrowse("emptyTitle")}
          </p>
          <p className="text-[13px] text-text-muted">
            {tBrowse("emptyHint")}
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
