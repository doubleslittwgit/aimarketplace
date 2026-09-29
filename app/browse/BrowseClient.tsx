"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import ToolCard from "@/components/ToolCard";
import { categories, type Tool } from "@/lib/mock-data";
import { categoryToSlug, ALL_CATEGORIES_VALUE } from "@/lib/category-slugs";
import { getEffectivePrice, isSaleActive } from "@/lib/sale-price";
import { TOOL_LANGUAGES, TOOL_LANGUAGE_NATIVE_NAMES } from "@/lib/tool-languages";

/**
 * 「ツールを探す」ページ。
 *
 * マーケットプレイスらしく、次の条件で絞り込める:
 *   カテゴリ・キーワード・価格（無料/有料/セール中/予算）・使い方（クラウド/ローカル）・対応OS・
 *   インターネット接続・対応言語・評価・その他（開発中を除く/改造OK/返金対応あり）
 * PCでは左の絞り込み欄、スマホでは「絞り込み」ボタンから下に開く画面で選ぶ。
 * よく使う条件は、上の「クイック絞り込み」からワンタップで切り替えられる。
 * 条件はURLにも反映するので、検索結果をそのまま共有・ブックマークできる。
 */

type SortKey = "recommended" | "new" | "popular" | "likes" | "rating" | "price_asc" | "price_desc";
type PriceFilter = "all" | "free" | "paid" | "sale";
type RuntimeFilter = "all" | "cloud" | "local";
type NetValue = "offline" | "partial" | "required";

type Filters = {
  q: string;
  category: string;
  price: PriceFilter;
  maxPrice: number | null;
  runtime: RuntimeFilter;
  os: string[];
  net: NetValue[];
  langs: string[];
  minRating: 0 | 3 | 4;
  hideWip: boolean;
  remix: boolean;
  refundable: boolean;
  sort: SortKey;
};

const OS_OPTIONS = ["Windows", "macOS", "Linux"] as const;
const NET_OPTIONS: NetValue[] = ["offline", "partial", "required"];
const BUDGETS = [500, 1000, 3000, 5000] as const;
const SORTS: SortKey[] = ["recommended", "new", "popular", "likes", "rating", "price_asc", "price_desc"];

function defaultFilters(q: string, category: string): Filters {
  return {
    q,
    category,
    price: "all",
    maxPrice: null,
    runtime: "all",
    os: [],
    net: [],
    langs: [],
    minRating: 0,
    hideWip: false,
    remix: false,
    refundable: false,
    sort: "recommended",
  };
}

/** URLの ?… から条件を読む（共有されたURLやブラウザの「戻る」で開いたとき用） */
function filtersFromParams(base: Filters, params: Record<string, string | undefined>): Filters {
  const p = new URLSearchParams(
    Object.entries(params).filter((e): e is [string, string] => typeof e[1] === "string")
  );
  const list = (k: string) => (p.get(k) ? p.get(k)!.split(",").filter(Boolean) : []);
  const price = p.get("price");
  const runtime = p.get("runtime");
  const rating = Number(p.get("rating"));
  const max = Number(p.get("max"));
  const sort = p.get("sort");
  return {
    ...base,
    price: price === "free" || price === "paid" || price === "sale" ? price : base.price,
    maxPrice: Number.isFinite(max) && max > 0 ? max : null,
    runtime: runtime === "cloud" || runtime === "local" ? runtime : base.runtime,
    os: list("os").filter((o) => (OS_OPTIONS as readonly string[]).includes(o)),
    net: list("net").filter((n): n is NetValue => (NET_OPTIONS as string[]).includes(n)),
    langs: list("lang").filter((l) => (TOOL_LANGUAGES as readonly string[]).includes(l)),
    minRating: rating === 3 || rating === 4 ? rating : 0,
    hideWip: p.get("wip") === "0",
    remix: p.get("remix") === "1",
    refundable: p.get("refund") === "1",
    sort: sort && (SORTS as string[]).includes(sort) ? (sort as SortKey) : base.sort,
  };
}

/** 条件をURLに書き出す（ページの再読み込みはしない） */
function writeUrl(f: Filters) {
  const p = new URLSearchParams();
  if (f.q.trim()) p.set("q", f.q.trim());
  if (f.category !== ALL_CATEGORIES_VALUE) p.set("category", f.category);
  if (f.price !== "all") p.set("price", f.price);
  if (f.maxPrice) p.set("max", String(f.maxPrice));
  if (f.runtime !== "all") p.set("runtime", f.runtime);
  if (f.os.length) p.set("os", f.os.join(","));
  if (f.net.length) p.set("net", f.net.join(","));
  if (f.langs.length) p.set("lang", f.langs.join(","));
  if (f.minRating) p.set("rating", String(f.minRating));
  if (f.hideWip) p.set("wip", "0");
  if (f.remix) p.set("remix", "1");
  if (f.refundable) p.set("refund", "1");
  if (f.sort !== "recommended") p.set("sort", f.sort);
  const query = p.toString();
  window.history.replaceState(null, "", query ? `/browse?${query}` : "/browse");
}

type FacetKey = "q" | "category" | "price" | "maxPrice" | "runtime" | "os" | "net" | "langs" | "minRating" | "other";

/** 1つのツールが条件に合うか。skip に指定した条件は見ない（各選択肢の件数を出すため） */
function matches(t: Tool, f: Filters, skip?: FacetKey): boolean {
  const q = f.q.trim().toLowerCase();
  if (skip !== "q" && q) {
    const hay = [t.name, t.tagline, t.description, t.author.name, ...t.tags].join(" ").toLowerCase();
    if (!hay.includes(q)) return false;
  }
  if (skip !== "category" && f.category !== ALL_CATEGORIES_VALUE && !t.categories.includes(f.category)) return false;

  const sale = isSaleActive({ price: t.price, sale_price: t.salePrice, sale_ends_at: t.saleEndsAt });
  const effective = getEffectivePrice({ price: t.price, sale_price: t.salePrice, sale_ends_at: t.saleEndsAt });
  if (skip !== "price") {
    if (f.price === "free" && t.price !== 0) return false;
    if (f.price === "paid" && t.price === 0) return false;
    if (f.price === "sale" && !sale) return false;
  }
  if (skip !== "maxPrice" && f.maxPrice !== null && effective > f.maxPrice) return false;
  if (skip !== "runtime" && f.runtime !== "all" && t.runtime !== f.runtime) return false;
  if (skip !== "os" && f.os.length) {
    // 対応OSはローカル実行のツールだけの情報。クラウドのツールはOSを問わず使えるので含める
    if (t.runtime === "local" && !f.os.some((o) => (t.platforms ?? []).includes(o))) return false;
  }
  if (skip !== "net" && f.net.length && !(t.internetAccess && f.net.includes(t.internetAccess))) return false;
  if (skip !== "langs" && f.langs.length && !f.langs.some((l) => (t.uiLanguages ?? []).includes(l))) return false;
  if (skip !== "minRating" && f.minRating && ((t.ratingCount ?? 0) === 0 || (t.ratingAvg ?? 0) < f.minRating)) return false;
  if (skip !== "other") {
    if (f.hideWip && t.isWip) return false;
    if (f.remix && !t.remixAllowed) return false;
    if (f.refundable && t.refundPolicy !== "conditional") return false;
  }
  return true;
}

function sortTools(list: Tool[], sort: SortKey): Tool[] {
  const price = (t: Tool) => getEffectivePrice({ price: t.price, sale_price: t.salePrice, sale_ends_at: t.saleEndsAt });
  const time = (t: Tool) => new Date(t.updatedAt).getTime() || 0;
  const copy = [...list];
  switch (sort) {
    case "new":
      return copy.sort((a, b) => time(b) - time(a));
    case "popular":
      return copy.sort((a, b) => b.installs - a.installs);
    case "likes":
      return copy.sort((a, b) => b.likes - a.likes);
    case "rating":
      return copy.sort(
        (a, b) => (b.ratingAvg ?? 0) - (a.ratingAvg ?? 0) || (b.ratingCount ?? 0) - (a.ratingCount ?? 0)
      );
    case "price_asc":
      return copy.sort((a, b) => price(a) - price(b));
    case "price_desc":
      return copy.sort((a, b) => price(b) - price(a));
    default: {
      // おすすめ：入手数・いいね・評価に、新しさを少し足した点数
      const now = Date.now();
      const score = (t: Tool) => {
        const days = Math.max(0, (now - time(t)) / 86_400_000);
        const freshness = Math.max(0, 30 - days) / 3; // 公開・更新から30日は少し上に
        const rating = (t.ratingAvg ?? 0) * Math.min(t.ratingCount ?? 0, 10);
        return t.installs + t.likes * 3 + rating * 2 + freshness;
      };
      return copy.sort((a, b) => score(b) - score(a));
    }
  }
}

export default function BrowseClient({
  initialTools,
  initialQuery = "",
  initialCategory = ALL_CATEGORIES_VALUE,
  initialParams = {},
}: {
  initialTools: Tool[];
  initialQuery?: string;
  initialCategory?: string;
  /** URLの ?… をそのまま受け取る（共有されたURLで開いたときに条件を復元する） */
  initialParams?: Record<string, string | undefined>;
}) {
  const t = useTranslations("browse");
  const tCategories = useTranslations("categories");
  const tLang = useTranslations("submit.languages");

  // 共有されたURL（?price=free&runtime=local など）で開いたときは、その条件で始める
  const [filters, setFilters] = useState<Filters>(() =>
    filtersFromParams(defaultFilters(initialQuery, initialCategory), initialParams)
  );
  const [sheetOpen, setSheetOpen] = useState(false);

  // ヘッダーの検索やカテゴリのリンクから来た場合は、その値に合わせる
  const [synced, setSynced] = useState({ q: initialQuery, category: initialCategory });
  if (synced.q !== initialQuery || synced.category !== initialCategory) {
    setSynced({ q: initialQuery, category: initialCategory });
    setFilters((f) => ({ ...f, q: initialQuery, category: initialCategory }));
  }

  // 条件を変えたらURLにも反映する（そのまま共有・ブックマークできるように）
  useEffect(() => {
    writeUrl(filters);
  }, [filters]);

  // スマホの絞り込み画面を開いている間は、後ろのページがスクロールしないようにする
  useEffect(() => {
    if (!sheetOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [sheetOpen]);

  const update = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));
  const toggleIn = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const results = useMemo(
    () => sortTools(initialTools.filter((tool) => matches(tool, filters)), filters.sort),
    [initialTools, filters]
  );

  // 各選択肢の件数（その項目以外は、今の条件のまま数える）
  const countFacet = (skip: FacetKey, test: (tool: Tool) => boolean) =>
    initialTools.filter((tool) => matches(tool, filters, skip) && test(tool)).length;

  // 言語の選択肢は、実際に出品されている言語だけを出す
  const languageOptions = useMemo(() => {
    const present = new Set(initialTools.flatMap((tool) => tool.uiLanguages ?? []));
    return TOOL_LANGUAGES.filter((l) => present.has(l) || l === "ja" || l === "en");
  }, [initialTools]);

  const langLabel = (l: string) =>
    l === "other" ? tLang("other") : TOOL_LANGUAGE_NATIVE_NAMES[l as keyof typeof TOOL_LANGUAGE_NATIVE_NAMES] ?? l;

  // 絞り込み中の条件（外せるチップとして並べる）
  const active: { key: string; label: string; clear: () => void }[] = [];
  if (filters.q.trim()) active.push({ key: "q", label: `"${filters.q.trim()}"`, clear: () => update({ q: "" }) });
  if (filters.category !== ALL_CATEGORIES_VALUE)
    active.push({ key: "cat", label: tCategories(categoryToSlug(filters.category)), clear: () => update({ category: ALL_CATEGORIES_VALUE }) });
  if (filters.price !== "all")
    active.push({ key: "price", label: t(`price.${filters.price}`), clear: () => update({ price: "all" }) });
  if (filters.maxPrice)
    active.push({ key: "max", label: t("budget.under", { amount: filters.maxPrice.toLocaleString() }), clear: () => update({ maxPrice: null }) });
  if (filters.runtime !== "all")
    active.push({ key: "rt", label: t(`runtime.${filters.runtime}Short`), clear: () => update({ runtime: "all" }) });
  for (const o of filters.os) active.push({ key: `os-${o}`, label: o, clear: () => update({ os: filters.os.filter((x) => x !== o) }) });
  for (const n of filters.net)
    active.push({ key: `net-${n}`, label: t(`net.${n}Short`), clear: () => update({ net: filters.net.filter((x) => x !== n) }) });
  for (const l of filters.langs)
    active.push({ key: `lang-${l}`, label: langLabel(l), clear: () => update({ langs: filters.langs.filter((x) => x !== l) }) });
  if (filters.minRating)
    active.push({ key: "rating", label: t("rating.atLeast", { n: filters.minRating }), clear: () => update({ minRating: 0 }) });
  if (filters.hideWip) active.push({ key: "wip", label: t("other.hideWip"), clear: () => update({ hideWip: false }) });
  if (filters.remix) active.push({ key: "remix", label: t("other.remix"), clear: () => update({ remix: false }) });
  if (filters.refundable) active.push({ key: "refund", label: t("other.refundable"), clear: () => update({ refundable: false }) });

  const clearAll = () => setFilters((f) => ({ ...defaultFilters("", ALL_CATEGORIES_VALUE), sort: f.sort }));
  const filterCount = active.filter((a) => a.key !== "q" && a.key !== "cat").length;

  // クイック絞り込み（よく使う条件をワンタップで）
  const quick: { key: string; label: string; on: boolean; toggle: () => void }[] = [
    { key: "free", label: t("quick.free"), on: filters.price === "free", toggle: () => update({ price: filters.price === "free" ? "all" : "free" }) },
    { key: "sale", label: t("quick.sale"), on: filters.price === "sale", toggle: () => update({ price: filters.price === "sale" ? "all" : "sale" }) },
    { key: "cloud", label: t("quick.cloud"), on: filters.runtime === "cloud", toggle: () => update({ runtime: filters.runtime === "cloud" ? "all" : "cloud" }) },
    { key: "local", label: t("quick.local"), on: filters.runtime === "local", toggle: () => update({ runtime: filters.runtime === "local" ? "all" : "local" }) },
    { key: "offline", label: t("quick.offline"), on: filters.net.includes("offline"), toggle: () => update({ net: toggleIn(filters.net, "offline") }) },
    { key: "ja", label: t("quick.japanese"), on: filters.langs.includes("ja"), toggle: () => update({ langs: toggleIn(filters.langs, "ja") }) },
    { key: "rating", label: t("quick.rating"), on: filters.minRating === 4, toggle: () => update({ minRating: filters.minRating === 4 ? 0 : 4 }) },
  ];

  const panel = (
    <FilterPanel
      filters={filters}
      update={update}
      toggleIn={toggleIn}
      countFacet={countFacet}
      languageOptions={languageOptions}
      langLabel={langLabel}
    />
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-text-primary">{t("title")}</h1>
          <p className="mt-1 text-[13px] text-text-muted">{t("resultsCount", { count: results.length })}</p>
        </div>
      </div>

      {/* キーワード検索 */}
      <div className="mb-4 flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-3 shadow-sm focus-within:border-border-strong">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-text-muted" aria-hidden>
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          type="search"
          value={filters.q}
          onChange={(e) => update({ q: e.target.value })}
          placeholder={t("searchPlaceholderLong")}
          aria-label={t("searchPlaceholderLong")}
          className="w-full bg-transparent text-[15px] outline-none placeholder:text-text-dim"
        />
        {filters.q && (
          <button type="button" onClick={() => update({ q: "" })} aria-label={t("clearSearch")} className="shrink-0 px-1 text-[18px] leading-none text-text-dim hover:text-text-primary">
            ×
          </button>
        )}
      </div>

      {/* カテゴリ（横にスクロール） */}
      <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        <Pill
          label={t("categoryAll")}
          active={filters.category === ALL_CATEGORIES_VALUE}
          onClick={() => update({ category: ALL_CATEGORIES_VALUE })}
        />
        {categories.map((c) => (
          <Pill key={c} label={tCategories(categoryToSlug(c))} active={filters.category === c} onClick={() => update({ category: c })} />
        ))}
      </div>

      {/* クイック絞り込み */}
      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {quick.map((q) => (
          <button
            key={q.key}
            type="button"
            aria-pressed={q.on}
            onClick={q.toggle}
            className={`shrink-0 whitespace-nowrap rounded-lg border px-3 py-1.5 text-[12px] font-medium transition ${
              q.on
                ? "border-accent-ai bg-accent-ai text-white"
                : "border-border bg-bg text-text-secondary hover:border-border-strong hover:text-text-primary"
            }`}
          >
            {q.on && "✓ "}
            {q.label}
          </button>
        ))}
      </div>

      <div className="flex gap-8">
        {/* PC：左の絞り込み欄 */}
        <aside className="hidden w-60 shrink-0 lg:block">
          <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pr-1">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[14px] font-semibold text-text-primary">{t("filtersTitle")}</p>
              {filterCount > 0 && (
                <button type="button" onClick={clearAll} className="text-[12px] text-accent-signal hover:underline">
                  {t("clearAll")}
                </button>
              )}
            </div>
            {panel}
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          {/* 並べ替え・スマホの絞り込みボタン */}
          <div className="mb-3 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-[13px] font-medium text-text-primary lg:hidden"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <path d="M4 6h16M7 12h10M10 18h4" />
              </svg>
              {t("filterButton")}
              {filterCount > 0 && (
                <span className="rounded-full bg-accent-signal px-1.5 text-[11px] font-semibold text-white">{filterCount}</span>
              )}
            </button>
            <label className="ml-auto flex items-center gap-2 text-[12px] text-text-muted">
              <span className="hidden sm:inline">{t("sortLabel")}</span>
              <select
                value={filters.sort}
                onChange={(e) => update({ sort: e.target.value as SortKey })}
                className="rounded-lg border border-border bg-surface px-3 py-2 text-[13px] text-text-secondary outline-none"
              >
                {SORTS.map((s) => (
                  <option key={s} value={s}>
                    {t(`sort.${s}`)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* 絞り込み中の条件 */}
          {active.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-1.5">
              <span className="text-[12px] text-text-muted">{t("activeFilters")}</span>
              {active.map((a) => (
                <button
                  key={a.key}
                  type="button"
                  onClick={a.clear}
                  className="flex items-center gap-1 rounded-full bg-accent-ai-dim px-2.5 py-1 text-[12px] text-accent-ai hover:brightness-95"
                >
                  {a.label}
                  <span aria-hidden className="text-[14px] leading-none">×</span>
                  <span className="sr-only">{t("remove")}</span>
                </button>
              ))}
              <button type="button" onClick={clearAll} className="ml-1 text-[12px] text-text-muted underline hover:text-text-primary">
                {t("clearAll")}
              </button>
            </div>
          )}

          {results.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border px-6 py-16 text-center">
              <p className="mb-1 text-[15px] font-semibold text-text-primary">{t("emptyTitle")}</p>
              <p className="mb-5 text-[13px] text-text-muted">{t("emptyHint")}</p>
              <div className="flex flex-wrap justify-center gap-2">
                {active.length > 0 && (
                  <button
                    type="button"
                    onClick={clearAll}
                    className="rounded-full bg-accent-signal px-5 py-2 text-[13px] font-medium text-white hover:brightness-110"
                  >
                    {t("emptyClear")}
                  </button>
                )}
                <Link
                  href="/requests"
                  className="rounded-full border border-border bg-bg px-5 py-2 text-[13px] font-medium text-text-primary hover:bg-surface"
                >
                  {t("emptyRequest")}
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {results.map((tool) => (
                <ToolCard key={tool.id} tool={tool} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* スマホ：下から開く絞り込み画面 */}
      {sheetOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={t("filtersTitle")}>
          <button type="button" aria-label={t("close")} onClick={() => setSheetOpen(false)} className="absolute inset-0 bg-text-primary/40" />
          <div className="absolute inset-x-0 bottom-0 flex max-h-[85vh] flex-col rounded-t-2xl bg-bg shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <p className="text-[15px] font-semibold text-text-primary">{t("filtersTitle")}</p>
              <div className="flex items-center gap-4">
                {filterCount > 0 && (
                  <button type="button" onClick={clearAll} className="text-[13px] text-accent-signal">
                    {t("clearAll")}
                  </button>
                )}
                <button type="button" onClick={() => setSheetOpen(false)} aria-label={t("close")} className="text-[22px] leading-none text-text-muted">
                  ×
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">{panel}</div>
            <div className="border-t border-border p-4">
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                className="w-full rounded-xl bg-accent-signal py-3 text-[14px] font-semibold text-white hover:brightness-110"
              >
                {t("showResults", { count: results.length })}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** 絞り込みの各項目（PCの左欄とスマホの画面で共通） */
function FilterPanel({
  filters,
  update,
  toggleIn,
  countFacet,
  languageOptions,
  langLabel,
}: {
  filters: Filters;
  update: (patch: Partial<Filters>) => void;
  toggleIn: <T>(list: T[], v: T) => T[];
  countFacet: (skip: FacetKey, test: (tool: Tool) => boolean) => number;
  languageOptions: readonly string[];
  langLabel: (l: string) => string;
}) {
  const t = useTranslations("browse");
  const sale = (tool: Tool) => isSaleActive({ price: tool.price, sale_price: tool.salePrice, sale_ends_at: tool.saleEndsAt });
  const effective = (tool: Tool) =>
    getEffectivePrice({ price: tool.price, sale_price: tool.salePrice, sale_ends_at: tool.saleEndsAt });

  return (
    <div className="space-y-6">
      <Section title={t("sections.price")}>
        {(["all", "free", "paid", "sale"] as PriceFilter[]).map((p) => (
          <Radio
            key={p}
            checked={filters.price === p}
            onChange={() => update({ price: p })}
            label={t(`price.${p}`)}
            count={
              p === "all"
                ? undefined
                : countFacet("price", (tool) => (p === "free" ? tool.price === 0 : p === "paid" ? tool.price > 0 : sale(tool)))
            }
          />
        ))}
      </Section>

      <Section title={t("sections.budget")}>
        <div className="flex flex-wrap gap-1.5">
          <Chip on={filters.maxPrice === null} onClick={() => update({ maxPrice: null })} label={t("budget.any")} />
          {BUDGETS.map((b) => (
            <Chip
              key={b}
              on={filters.maxPrice === b}
              onClick={() => update({ maxPrice: filters.maxPrice === b ? null : b })}
              label={t("budget.under", { amount: b.toLocaleString() })}
              count={countFacet("maxPrice", (tool) => effective(tool) <= b)}
            />
          ))}
        </div>
      </Section>

      <Section title={t("sections.runtime")} hint={t("runtime.hint")}>
        {(["all", "cloud", "local"] as RuntimeFilter[]).map((r) => (
          <Radio
            key={r}
            checked={filters.runtime === r}
            onChange={() => update({ runtime: r })}
            label={t(`runtime.${r}`)}
            count={r === "all" ? undefined : countFacet("runtime", (tool) => tool.runtime === r)}
          />
        ))}
      </Section>

      {filters.runtime !== "cloud" && (
        <Section title={t("sections.os")}>
          {OS_OPTIONS.map((o) => (
            <Check
              key={o}
              checked={filters.os.includes(o)}
              onChange={() => update({ os: toggleIn(filters.os, o) })}
              label={o}
              count={countFacet("os", (tool) => tool.runtime === "local" && (tool.platforms ?? []).includes(o))}
            />
          ))}
        </Section>
      )}

      <Section title={t("sections.net")}>
        {NET_OPTIONS.map((n) => (
          <Check
            key={n}
            checked={filters.net.includes(n)}
            onChange={() => update({ net: toggleIn(filters.net, n) })}
            label={t(`net.${n}`)}
            count={countFacet("net", (tool) => tool.internetAccess === n)}
          />
        ))}
      </Section>

      <Section title={t("sections.languages")}>
        {languageOptions.map((l) => (
          <Check
            key={l}
            checked={filters.langs.includes(l)}
            onChange={() => update({ langs: toggleIn(filters.langs, l) })}
            label={langLabel(l)}
            count={countFacet("langs", (tool) => (tool.uiLanguages ?? []).includes(l))}
          />
        ))}
      </Section>

      <Section title={t("sections.rating")}>
        {([0, 4, 3] as const).map((n) => (
          <Radio
            key={n}
            checked={filters.minRating === n}
            onChange={() => update({ minRating: n })}
            label={n === 0 ? t("rating.any") : t("rating.atLeast", { n })}
            count={
              n === 0
                ? undefined
                : countFacet("minRating", (tool) => (tool.ratingCount ?? 0) > 0 && (tool.ratingAvg ?? 0) >= n)
            }
          />
        ))}
      </Section>

      <Section title={t("sections.other")}>
        <Check
          checked={filters.hideWip}
          onChange={() => update({ hideWip: !filters.hideWip })}
          label={t("other.hideWip")}
        />
        <Check
          checked={filters.remix}
          onChange={() => update({ remix: !filters.remix })}
          label={t("other.remix")}
          count={countFacet("other", (tool) => Boolean(tool.remixAllowed))}
        />
        <Check
          checked={filters.refundable}
          onChange={() => update({ refundable: !filters.refundable })}
          label={t("other.refundable")}
          count={countFacet("other", (tool) => tool.refundPolicy === "conditional")}
        />
      </Section>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-2 text-[13px] font-semibold text-text-primary">{title}</legend>
      {hint && <p className="-mt-1 mb-2 text-[11px] leading-relaxed text-text-dim">{hint}</p>}
      <div className="space-y-1">{children}</div>
    </fieldset>
  );
}

function Count({ n }: { n?: number }) {
  if (n === undefined) return null;
  return <span className="ml-auto pl-2 font-mono text-[11px] text-text-dim">{n}</span>;
}

function Radio({ checked, onChange, label, count }: { checked: boolean; onChange: () => void; label: string; count?: number }) {
  return (
    <label className={`flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-[13px] hover:bg-surface ${count === 0 && !checked ? "opacity-50" : ""}`}>
      <input type="radio" checked={checked} onChange={onChange} className="h-3.5 w-3.5 accent-[var(--accent-signal)]" />
      <span className={checked ? "font-medium text-text-primary" : "text-text-secondary"}>{label}</span>
      <Count n={count} />
    </label>
  );
}

function Check({ checked, onChange, label, count }: { checked: boolean; onChange: () => void; label: string; count?: number }) {
  return (
    <label className={`flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-[13px] hover:bg-surface ${count === 0 && !checked ? "opacity-50" : ""}`}>
      <input type="checkbox" checked={checked} onChange={onChange} className="h-3.5 w-3.5 rounded accent-[var(--accent-signal)]" />
      <span className={checked ? "font-medium text-text-primary" : "text-text-secondary"}>{label}</span>
      <Count n={count} />
    </label>
  );
}

function Chip({ on, onClick, label, count }: { on: boolean; onClick: () => void; label: string; count?: number }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1 text-[12px] transition ${
        on ? "border-accent-signal/50 bg-accent-signal-dim text-accent-signal" : "border-border text-text-secondary hover:border-border-strong"
      }`}
    >
      {label}
      {count !== undefined && <span className="ml-1 text-text-dim">{count}</span>}
    </button>
  );
}

function Pill({ label, active, onClick }: { label: string; active?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
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
