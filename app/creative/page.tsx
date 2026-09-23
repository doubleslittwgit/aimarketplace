import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ToolCard from "@/components/ToolCard";
import RainbowBlurs from "@/components/creative/RainbowBlurs";
import { createClient } from "@/lib/supabase/server";
import { applyToolTranslations } from "@/lib/apply-translations";
import { CREATIVE_APPS, CREATIVE_CATEGORIES, CREATIVE_TOOL_CATEGORIES, getCreativeApp } from "@/lib/creative-apps";
import type { Locale } from "@/i18n/config";
import type { Tool } from "@/lib/mock-data";

export async function generateMetadata() {
  const t = await getTranslations("creativeHome");
  return { title: t("meta.title"), description: t("meta.description") };
}


export default async function CreativePage({
  searchParams,
}: {
  searchParams: Promise<{ app?: string }>;
}) {
  const t = await getTranslations("creativeHome");
  const { app: appFilter } = await searchParams;
  const locale = (await getLocale()) as Locale;
  const supabase = await createClient();
  const activeApp = appFilter ? getCreativeApp(appFilter) : undefined;

  let query = supabase
    .from("tools")
    .select("*, profiles:author_id(display_name, handle)")
    .eq("status", "published")
    .not("host_apps", "eq", "{}")
    .order("install_count", { ascending: false })
    .limit(12);
  if (activeApp) query = query.contains("host_apps", [activeApp.slug]);
  // プラグインとは別に、クリエイティブ系カテゴリの「単体で動くツール」も集める。
  // プラグイン欄と重複しないよう、対応ソフトを持たないものだけにする。
  const [{ data: rows }, { data: toolRows }] = await Promise.all([
    query,
    supabase
      .from("tools")
      .select("*, profiles:author_id(display_name, handle)")
      .eq("status", "published")
      .eq("host_apps", "{}")
      .overlaps("categories", CREATIVE_TOOL_CATEGORIES)
      .order("install_count", { ascending: false })
      .limit(12),
  ]);

  const tCommon = await getTranslations("common");
  const toTool = (r: NonNullable<typeof rows>[number]) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    tagline: r.tagline,
    description: r.description,
    category: r.category,
    categories: r.categories?.length ? r.categories : [r.category],
    price: r.price,
    version: r.version,
    installs: r.install_count,
    likes: r.like_count,
    views: r.view_count,
    author: {
      name: r.profiles?.display_name || tCommon("unnamedDeveloper"),
      handle: r.profiles?.handle ? `@${r.profiles.handle}` : "",
    },
    tags: r.tags || [],
    updatedAt: (r.updated_at || "").slice(0, 10),
    runtime: r.runtime,
    thumbnailUrl: r.thumbnail_url || null,
    salePrice: r.sale_price ?? null,
    saleEndsAt: r.sale_ends_at ?? null,
    isWip: r.is_wip ?? false,
    hostApps: (r.host_apps as string[] | null) ?? [],
  });
  const [plugins, creativeTools] = (await Promise.all([
    applyToolTranslations(supabase, (rows ?? []).map(toTool), locale),
    applyToolTranslations(supabase, (toolRows ?? []).map(toTool), locale),
  ])) as (Tool & { hostApps: string[] })[][];

  return (
    <>
      <Header />
      <main className="flex-1">
        {/* ================= ヒーロー（白地に虹色のぼかし） ================= */}
        <section className="relative overflow-hidden border-b border-border bg-bg">
          <RainbowBlurs />

          <div className="relative mx-auto max-w-7xl px-6 py-16 sm:py-24">
            <div className="max-w-2xl">
              <h1 className="sr-only">BuildBay Creative</h1>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/creative-logo.png"
                alt="BuildBay Creative"
                width={1400}
                height={206}
                className="h-auto w-full max-w-xl"
              />
              <p className="mt-8 font-display text-2xl font-semibold leading-snug [word-break:auto-phrase] text-text-primary sm:text-3xl">
                {t("hero.catch")}
              </p>
              <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-text-secondary sm:text-base">
                {t("hero.sub")}
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-4">
                <a
                  href="#featured"
                  className="flex items-center gap-2 rounded-full bg-accent-signal px-7 py-3.5 text-[15px] font-medium text-white shadow-[0_10px_30px_-6px_rgba(255,107,74,0.55)] transition hover:-translate-y-0.5 hover:brightness-110"
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <circle cx="11" cy="11" r="7" />
                    <path d="m21 21-4.3-4.3" />
                  </svg>
                  {t("hero.ctaBrowse")}
                </a>
                <Link
                  href="/submit"
                  className="flex items-center gap-2 rounded-full border border-border bg-bg/80 px-7 py-3.5 text-[15px] font-medium text-text-primary shadow-[0_10px_30px_-8px_rgba(37,99,180,0.35)] backdrop-blur transition hover:-translate-y-0.5 hover:border-border-strong hover:bg-bg"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 16V4M12 4 7 9M12 4l5 5" />
                    <path d="M20 16.5v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2" />
                  </svg>
                  {t("hero.ctaPublish")}
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ================= 対応アプリケーション ================= */}
        <section className="mx-auto max-w-7xl px-6 py-12">
          <h2 className="font-display text-2xl font-semibold text-text-primary">{t("apps.title")}</h2>
          <p className="mt-1 text-[13px] text-text-muted">{t("apps.sub")}</p>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {CREATIVE_APPS.map((app) => {
              const active = activeApp?.slug === app.slug;
              return (
                <Link
                  key={app.slug}
                  href={active ? "/creative#featured" : `/creative?app=${app.slug}#featured`}
                  className={`flex items-center gap-3 rounded-xl border px-4 py-3.5 transition ${
                    active
                      ? "border-accent-signal bg-accent-signal/5"
                      : "border-border bg-surface hover:border-border-strong hover:bg-bg"
                  }`}
                >
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[12px] font-bold text-white"
                    style={{ backgroundColor: app.color }}
                  >
                    {app.shortLabel}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-semibold text-text-primary">{app.name}</span>
                    <span className="block truncate text-[11px] text-text-muted">{t(`apps.desc.${app.slug}`)}</span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        {/* ================= プラグイン一覧（トップページと同じカードを使う） ================= */}
        <section id="featured" className="scroll-mt-20 border-t border-border">
          <div className="mx-auto max-w-7xl px-6 py-12">
            <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h2 className="font-display text-2xl font-semibold text-text-primary">
                  {activeApp ? t("featured.titleForApp", { app: activeApp.name }) : t("featured.title")}
                </h2>
                <p className="mt-1 text-[13px] text-text-muted">{t("featured.sub")}</p>
              </div>
              {activeApp && (
                <Link href="/creative#featured" className="text-[13px] text-text-muted hover:text-text-primary">
                  {t("featured.clear")}
                </Link>
              )}
            </div>

            {plugins.length === 0 ? (
              <div className="flex flex-col items-center rounded-xl border border-dashed border-border-strong bg-surface py-16 text-center">
                <p className="text-[14px] text-text-secondary">
                  {activeApp ? t("featured.emptyForApp", { app: activeApp.name }) : t("featured.empty")}
                </p>
                <Link
                  href="/submit"
                  className="mt-4 rounded-full bg-accent-signal px-5 py-2.5 text-[13px] font-medium text-white transition hover:brightness-110"
                >
                  {t("featured.beFirst")}
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {plugins.map((p) => {
                  const host = CREATIVE_APPS.find((a) => p.hostApps.includes(a.slug));
                  return (
                    <div key={p.id} className="relative">
                      <ToolCard tool={p} />
                      {host && (
                        <span
                          className="pointer-events-none absolute right-3 top-3 z-10 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white shadow"
                          style={{ backgroundColor: host.color }}
                        >
                          {host.shortLabel}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* ================= クリエイティブツール（単体で動くもの） ================= */}
        <section className="border-t border-border">
          <div className="mx-auto max-w-7xl px-6 py-12">
            <h2 className="font-display text-2xl font-semibold text-text-primary">{t("tools.title")}</h2>
            <p className="mt-1 text-[13px] text-text-muted">{t("tools.sub")}</p>
            {creativeTools.length === 0 ? (
              <div className="mt-6 flex flex-col items-center rounded-xl border border-dashed border-border-strong bg-surface py-14 text-center">
                <p className="text-[14px] text-text-secondary">{t("tools.empty")}</p>
                <Link
                  href="/submit"
                  className="mt-4 rounded-full bg-accent-signal px-5 py-2.5 text-[13px] font-medium text-white transition hover:brightness-110"
                >
                  {t("featured.beFirst")}
                </Link>
              </div>
            ) : (
              <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {creativeTools.map((tool) => (
                  <ToolCard key={tool.id} tool={tool} />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ================= カテゴリ ================= */}
        <section className="border-t border-border">
          <div className="mx-auto max-w-7xl px-6 py-12">
            <h2 className="font-display text-2xl font-semibold text-text-primary">{t("categories.title")}</h2>
            <p className="mt-1 text-[13px] text-text-muted">{t("categories.sub")}</p>
            <div className="mt-6 flex flex-wrap gap-2.5">
              {CREATIVE_CATEGORIES.map((cat) => (
                <span
                  key={cat}
                  className="rounded-full border border-border bg-surface px-4 py-2 text-[13px] text-text-secondary"
                >
                  {cat}
                </span>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
