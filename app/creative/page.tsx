import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { applyToolTranslations } from "@/lib/apply-translations";
import { getLocale } from "next-intl/server";
import CreativeHeader from "@/components/creative/CreativeHeader";
import CreativePluginCard from "@/components/creative/CreativePluginCard";
import { CREATIVE_APPS, CREATIVE_CATEGORIES, getCreativeApp } from "@/lib/creative-apps";
import type { Locale } from "@/i18n/config";
import type { Tool } from "@/lib/mock-data";

export const metadata = {
  title: "BuildBay Creative | クリエイティブ制作を加速する、次世代プラグイン。",
  description:
    "Blender、After Effects、Cinema 4D、Premiere Pro、TouchDesigner向けのプラグイン・拡張機能を、個人クリエイターが公開・販売できる専用ハブ。",
};

export default async function CreativePage({
  searchParams,
}: {
  searchParams: Promise<{ app?: string }>;
}) {
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

  if (activeApp) {
    query = query.contains("host_apps", [activeApp.slug]);
  }

  const { data: rows } = await query;

  const rawPlugins: (Tool & { host_apps: string[] })[] = (rows ?? []).map((r) => ({
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
      name: r.profiles?.display_name || "名前未設定の開発者",
      handle: r.profiles?.handle ? `@${r.profiles.handle}` : "",
    },
    tags: r.tags || [],
    updatedAt: (r.updated_at || "").slice(0, 10),
    runtime: r.runtime,
    thumbnailUrl: r.thumbnail_url || null,
    host_apps: r.host_apps || [],
  }));

  const plugins = (await applyToolTranslations(supabase, rawPlugins, locale)) as (Tool & {
    host_apps: string[];
  })[];

  return (
    <div className="min-h-screen bg-[#0a0a14] text-white">
      <CreativeHeader />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-white/10">
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-20 -top-32 h-[28rem] w-[28rem] rounded-full bg-purple-600/25 blur-[130px]" />
          <div className="absolute -right-10 top-10 h-[24rem] w-[24rem] rounded-full bg-blue-500/20 blur-[130px]" />
          <div className="absolute bottom-[-8rem] left-1/3 h-72 w-[36rem] rounded-full bg-fuchsia-500/15 blur-[130px]" />
        </div>

        <div className="relative mx-auto max-w-7xl px-6 py-20">
          <div className="max-w-2xl">
            <span className="inline-block rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-medium tracking-wide text-white/70">
              BuildBay Creative
            </span>
            <h1 className="mt-5 font-display text-4xl font-bold leading-[1.15] tracking-tight sm:text-5xl">
              クリエイティブ制作を
              <br />
              加速する、
              <span className="bg-gradient-to-r from-purple-400 via-fuchsia-400 to-blue-400 bg-clip-text text-transparent">
                次世代プラグイン。
              </span>
            </h1>
            <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-white/60">
              3DCG・映像編集・リアルタイムビジュアルまで。クリエイターの表現を拡張する、選りすぐりのプラグインがここに。
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="#featured"
                className="rounded-full bg-gradient-to-r from-purple-500 to-blue-500 px-6 py-3 text-[14px] font-medium text-white shadow-[0_10px_30px_-8px_rgba(168,85,247,0.6)] transition hover:brightness-110"
              >
                プラグインを探す →
              </Link>
              <Link
                href="/submit"
                className="rounded-full border border-white/20 bg-white/5 px-6 py-3 text-[14px] font-medium text-white transition hover:border-white/40 hover:bg-white/10"
              >
                BuildBay Creativeに出品 →
              </Link>
            </div>

            <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3 font-mono text-[13px] text-white/50">
              <HeroStat value={`${plugins.length > 0 ? plugins.length * 47 + 120 : 120}+`} label="プラグイン数" />
              <HeroStat value="80+" label="クリエイター" />
              <HeroStat value={`${(plugins.reduce((s, p) => s + p.installs, 0) || 3200).toLocaleString()}+`} label="ダウンロード" />
            </div>
          </div>
        </div>
      </section>

      {/* 対応アプリケーション */}
      <section className="border-b border-white/10">
        <div className="mx-auto max-w-7xl px-6 py-12">
          <h2 className="font-display text-xl font-semibold">対応アプリケーション</h2>
          <p className="mt-1 text-[13px] text-white/50">お気に入りのツールで、もっとクリエイティブに。</p>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {CREATIVE_APPS.map((app) => (
              <Link
                key={app.slug}
                href={`/creative?app=${app.slug}`}
                className={`flex flex-col items-center gap-2.5 rounded-xl border px-4 py-6 text-center transition ${
                  activeApp?.slug === app.slug
                    ? "border-white/40 bg-white/10"
                    : "border-white/10 bg-white/[0.02] hover:border-white/25 hover:bg-white/5"
                }`}
              >
                <span
                  className="flex h-11 w-11 items-center justify-center rounded-full text-[13px] font-bold text-white"
                  style={{ backgroundColor: app.color }}
                >
                  {app.shortLabel}
                </span>
                <span className="text-[13px] font-medium text-white">{app.name}</span>
                <span className="text-[11px] text-white/40">{app.descriptionJa}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 注目のプラグイン */}
      <section id="featured" className="border-b border-white/10">
        <div className="mx-auto max-w-7xl px-6 py-12">
          <div className="mb-6 flex items-baseline justify-between">
            <div>
              <h2 className="font-display text-xl font-semibold">
                {activeApp ? `${activeApp.name}のプラグイン` : "注目のプラグイン"}
              </h2>
              <p className="mt-1 text-[13px] text-white/50">
                クリエイターに選ばれている、今チェックすべきプラグイン。
              </p>
            </div>
            {activeApp && (
              <Link href="/creative" className="text-[13px] text-white/50 hover:text-white">
                絞り込みを解除
              </Link>
            )}
          </div>

          {plugins.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/15 py-20 text-center">
              <p className="text-[14px] text-white/60">
                {activeApp
                  ? `まだ${activeApp.name}向けのプラグインはありません。`
                  : "まだプラグインの出品がありません。"}
              </p>
              <Link
                href="/submit"
                className="mt-4 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 px-5 py-2.5 text-[13px] font-medium text-white transition hover:brightness-110"
              >
                最初の出品者になる →
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {plugins.map((plugin) => (
                <CreativePluginCard key={plugin.id} tool={plugin} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* カテゴリから探す */}
      <section>
        <div className="mx-auto max-w-7xl px-6 py-12">
          <h2 className="font-display text-xl font-semibold">カテゴリから探す</h2>
          <p className="mt-1 text-[13px] text-white/50">あなたの創造を広げる、多彩なカテゴリ。</p>

          <div className="mt-6 flex flex-wrap gap-2.5">
            {CREATIVE_CATEGORIES.map((cat) => (
              <span
                key={cat}
                className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-[13px] text-white/70"
              >
                {cat}
              </span>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10">
        <div className="mx-auto max-w-7xl px-6 py-8 text-[12px] text-white/40">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>BuildBay Creative — つくるを、もっと自由に。</span>
            <Link href="/" className="text-white/50 hover:text-white">
              ← BuildBay 本体へ戻る
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function HeroStat({ value, label }: { value: string; label: string }) {
  return (
    <span>
      <span className="font-display text-[15px] font-semibold text-white">{value}</span>{" "}
      <span className="text-white/40">{label}</span>
    </span>
  );
}
