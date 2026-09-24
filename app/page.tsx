import { getTranslations, getLocale } from "next-intl/server";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ActivityTicker from "@/components/ActivityTicker";
import LiveVisitorsWave from "@/components/LiveVisitorsWave";
import ToolCard from "@/components/ToolCard";
import HomeFeedPreview from "@/components/HomeFeedPreview";
import HomeRequestsPreview from "@/components/HomeRequestsPreview";
import HeroHeading from "@/components/HeroHeading";
import { createClient } from "@/lib/supabase/server";
import { categoryToSlug } from "@/lib/category-slugs";
import { applyToolTranslations } from "@/lib/apply-translations";
import { fetchFeedPosts } from "@/app/feed/actions";
import { fetchRequests } from "@/app/requests/actions";
import { CREATIVE_APPS } from "@/lib/creative-apps";
import { COURSE_CATEGORIES, CATEGORY_ICONS } from "@/lib/academy/categories";
import AcademyBlurs from "@/components/academy/AcademyBlurs";
import type { Locale } from "@/i18n/config";
import {
  categories,
  formatInstalls,
  formatPrice,
  type Tool,
} from "@/lib/mock-data";

async function loadRealTools(locale: Locale): Promise<Tool[]> {
  const tCommon = await getTranslations("common");
  const supabase = await createClient();
  const { data } = await supabase
    .from("tools")
    .select("*, profiles:author_id(display_name, handle)")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(6);

  const tools =
    data?.map((r) => ({
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
    })) || [];

  return applyToolTranslations(supabase, tools, locale);
}

async function loadSaleTools(locale: Locale): Promise<Tool[]> {
  const tCommon = await getTranslations("common");
  const supabase = await createClient();
  const { data } = await supabase
    .from("tools")
    .select("*, profiles:author_id(display_name, handle)")
    .eq("status", "published")
    .not("sale_price", "is", null)
    .gt("sale_ends_at", new Date().toISOString())
    .order("sale_ends_at", { ascending: true })
    .limit(6);

  const tools =
    data?.map((r) => ({
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
    })) || [];

  return applyToolTranslations(supabase, tools, locale);
}

/**
 * ヒーロー下に出す実績の数字。すべてDBの実データから数える（架空の数字は出さない）。
 * - 公開ツール数 / 開発者数（公開中ツールを持つ出品者の人数） / 累計ダウンロード数
 */
async function loadSiteStats() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tools")
    .select("author_id, install_count")
    .eq("status", "published");
  const rows = data ?? [];
  return {
    tools: rows.length,
    developers: new Set(rows.map((r) => r.author_id)).size,
    downloads: rows.reduce((sum, r) => sum + (r.install_count ?? 0), 0),
  };
}

function formatStat(n: number, locale: string) {
  const intlLocale = ({ ja: "ja-JP", zh: "zh-TW", en: "en-US" } as Record<string, string>)[locale] ?? "ja-JP";
  return new Intl.NumberFormat(intlLocale, n >= 10000 ? { notation: "compact", maximumFractionDigits: 1 } : {}).format(n);
}

export default async function Home() {
  const t = await getTranslations("home");
  const tCreative = await getTranslations("creativeHome");
  const tAcademy = await getTranslations("academyHome");
  const tCategories = await getTranslations("categories");
  const tCommon = await getTranslations("common");
  const locale = (await getLocale()) as Locale;

  const [realTools, saleTools, feedResult, requestsResult, stats] = await Promise.all([
    loadRealTools(locale),
    loadSaleTools(locale),
    fetchFeedPosts({ mode: "all" }),
    fetchRequests({ sort: "top" }),
    loadSiteStats(),
  ]);
  const feedPreview = feedResult.posts.slice(0, 3);
  const requestsPreview = requestsResult.requests.slice(0, 3);

  // 実際に公開されているツールだけを表示する（架空のデモ用ツールでは埋めない）
  const tools = realTools;
  // ヒーローで浮かせる4件（新着ツールと重複してよい紹介枠）
  const floatTools = tools.slice(0, 4);

  // プレビューの投稿・リクエストの投稿者/出品者が、実際にログイン中の本人かどうかは
  // ここでは判定しない（isLoggedInは各カード内のいいね・投稿導線の出し分け用）
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isLoggedIn = Boolean(user);

  return (
    <>
      <Header />
      <ActivityTicker />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          {/* 淡い青のブラー。下端で急に途切れて見えないよう、マスクで自然にフェードアウトさせる */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 overflow-hidden [mask-image:linear-gradient(to_bottom,black_70%,transparent_100%)]"
          >
            <div className="absolute -top-24 left-[12%] h-96 w-96 rounded-full bg-accent-ai/20 blur-[120px]" />
            <div className="absolute top-4 right-[10%] h-[26rem] w-[26rem] rounded-full bg-accent-ai/15 blur-[130px]" />
            <div className="absolute bottom-[-6rem] left-1/2 h-80 w-[44rem] -translate-x-1/2 rounded-full bg-accent-signal/10 blur-[130px]" />
          </div>

          {/* PC版（xl以上）専用: 背景にBuildBayカラーの四角を浮かせて、
              「商品がたくさんある」感を演出する（モバイル版と同じ考え方） */}
          <div aria-hidden className="pointer-events-none absolute inset-0 hidden overflow-hidden xl:block">
            <div className="absolute left-[6%] top-[8%] h-14 w-14 rotate-[-15deg] rounded-2xl bg-accent-ai/15 backdrop-blur-sm" />
            <div className="absolute right-[10%] top-[5%] h-9 w-9 rotate-[20deg] rounded-xl bg-accent-signal/20 backdrop-blur-sm" />
            <div className="absolute left-[22%] top-[14%] h-7 w-7 rotate-[10deg] rounded-lg bg-accent-signal/15 backdrop-blur-sm" />
            <div className="absolute right-[24%] top-[10%] h-10 w-10 rotate-[-12deg] rounded-xl bg-accent-ai/15 backdrop-blur-sm" />
            <div className="absolute left-[8%] top-[62%] h-11 w-11 rotate-[14deg] rounded-xl bg-accent-signal/15 backdrop-blur-sm" />
            <div className="absolute right-[6%] top-[58%] h-8 w-8 rotate-[-16deg] rounded-lg bg-accent-ai/20 backdrop-blur-sm" />
            <div className="absolute left-[16%] top-[80%] h-6 w-6 rotate-[8deg] rounded-md bg-accent-ai/15 backdrop-blur-sm" />
            <div className="absolute right-[18%] top-[84%] h-9 w-9 rotate-[-10deg] rounded-lg bg-accent-signal/15 backdrop-blur-sm" />
          </div>

          <div className="relative mx-auto max-w-7xl px-6 py-16 sm:py-36">
            {/* PC版（xl以上）: 実際に出品されているツールを浮かせて紹介 */}
            {floatTools[0] && (
              <FloatingCard
                tool={floatTools[0]}
                index={0}
                className="left-0 top-16 hidden -rotate-3 xl:block"
                anim="float-a"
                duration="9s"
                tCategories={tCategories}
                freeLabel={tCommon("free")}
              />
            )}
            {floatTools[1] && (
              <FloatingCard
                tool={floatTools[1]}
                index={1}
                className="left-2 top-[52%] hidden rotate-2 xl:block"
                anim="float-b"
                duration="11s"
                tCategories={tCategories}
                freeLabel={tCommon("free")}
              />
            )}
            {floatTools[2] && (
              <FloatingCard
                tool={floatTools[2]}
                index={2}
                className="right-0 top-20 hidden rotate-3 xl:block"
                anim="float-c"
                duration="10s"
                tCategories={tCategories}
                freeLabel={tCommon("free")}
              />
            )}
            {floatTools[3] && (
              <FloatingCard
                tool={floatTools[3]}
                index={3}
                className="right-2 top-[56%] hidden -rotate-2 xl:block"
                anim="float-d"
                duration="12.5s"
                tCategories={tCategories}
                freeLabel={tCommon("free")}
              />
            )}

            {/* xl未満（スマホ・タブレット）専用: 背景にBuildBayカラーのすりガラス調の
                四角を散らして「他にもまだツールがある」感を出しつつ、4隅に実際の
                ツールを小さく配置する。PC版の表示・コードには一切影響しない */}
            <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden xl:hidden">
              <div className="absolute left-[10%] top-[4%] h-11 w-11 rotate-[-15deg] rounded-xl bg-accent-ai/20 backdrop-blur-sm" />
              <div className="absolute right-[16%] top-[2%] h-7 w-7 rotate-[20deg] rounded-lg bg-accent-signal/25 backdrop-blur-sm" />
              <div className="absolute left-[4%] top-[24%] h-6 w-6 rotate-[12deg] rounded-lg bg-accent-signal/20 backdrop-blur-sm" />
              <div className="absolute right-[6%] top-[30%] h-9 w-9 rotate-[-18deg] rounded-xl bg-accent-ai/20 backdrop-blur-sm" />
              <div className="absolute left-[18%] top-[46%] h-7 w-7 rotate-[8deg] rounded-lg bg-accent-ai/15 backdrop-blur-sm" />
              <div className="absolute right-[22%] top-[52%] h-5 w-5 rotate-[-10deg] rounded-md bg-accent-signal/20 backdrop-blur-sm" />
              <div className="absolute left-[8%] top-[68%] h-10 w-10 rotate-[16deg] rounded-xl bg-accent-signal/15 backdrop-blur-sm" />
              <div className="absolute right-[10%] top-[74%] h-6 w-6 rotate-[-14deg] rounded-lg bg-accent-ai/20 backdrop-blur-sm" />
            </div>

            {floatTools[0] && (
              <MobileFloatingCard
                tool={floatTools[0]}
                className="left-2 top-[1%] -rotate-3 xl:hidden"
                freeLabel={tCommon("free")}
              />
            )}
            {floatTools[2] && (
              <MobileFloatingCard
                tool={floatTools[2]}
                className="right-2 top-[7%] rotate-3 xl:hidden"
                freeLabel={tCommon("free")}
              />
            )}
            {floatTools[1] && (
              <MobileFloatingCard
                tool={floatTools[1]}
                className="left-2 top-[33%] rotate-2 xl:hidden"
                freeLabel={tCommon("free")}
              />
            )}
            {floatTools[3] && (
              <MobileFloatingCard
                tool={floatTools[3]}
                className="right-2 top-[38%] -rotate-2 xl:hidden"
                freeLabel={tCommon("free")}
              />
            )}

            {/* 文字の後ろにだけ、輪郭のはっきりしない柔らかい光を敷いて、
                背後のカードとの境界を曖昧にする（四角いパネルにはしない）。
                z-indexをカード(z-5)より上・文字(z-10)より下にすることで、
                「カードの上に光が乗り、その上に文字が乗る」順序にする */}
            <div
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-[6%] z-[8] h-[34rem] w-[30rem] -translate-x-1/2 rounded-full bg-bg/90 blur-[80px] xl:hidden"
            />

            <div className="relative z-10 mx-auto flex max-w-2xl flex-col items-center text-center">
              {/* スマホでは背後の商品カードと重なるため、ロゴ・見出し・説明文の後ろに
                  白いマスクを敷く。カードが見えなくならないよう、各要素の形にぴったり沿わせ、
                  はみ出すのは縁のぼかし分（十数px）だけにしている。
                  ロゴ画像は上に約18%・下に約26%の透明な余白があるので、絵のある範囲に合わせる */}
              <span className="relative inline-block">
                <span aria-hidden className="pointer-events-none absolute rounded-3xl bg-bg shadow-[0_0_14px_10px_var(--bg)] sm:hidden -inset-x-2 top-[15%] bottom-[23%]" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/logo.png"
                  alt="BuildBay"
                  className="relative h-32 w-auto drop-shadow-[0_0_18px_rgba(255,255,255,0.9)] sm:h-48 sm:drop-shadow-none md:h-56 lg:h-64"
                />
              </span>

              <HeroHeading />
              <p className="relative isolate mt-6 max-w-[15rem] text-base leading-relaxed text-text-secondary [text-shadow:0_0_14px_rgba(255,255,255,0.95)] sm:max-w-md sm:text-lg sm:[text-shadow:none]">
                <span aria-hidden className="pointer-events-none absolute rounded-3xl bg-bg shadow-[0_0_14px_10px_var(--bg)] sm:hidden -inset-x-3 -inset-y-1 -z-10" />
                {t("heroSubcopy")}
              </p>

              <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
                <a
                  href="/submit"
                  className="flex items-center gap-2 rounded-full bg-accent-signal px-7 py-3.5 text-[15px] font-medium text-white shadow-[0_10px_30px_-6px_rgba(255,107,74,0.55)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_36px_-6px_rgba(255,107,74,0.65)] hover:brightness-110"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 16V4M12 4 7 9M12 4l5 5" />
                    <path d="M20 16.5v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2" />
                  </svg>
                  {t("ctaPublish")}
                </a>
                <a
                  href="/browse"
                  className="flex items-center gap-2 rounded-full border border-border bg-bg px-7 py-3.5 text-[15px] font-medium text-text-primary shadow-[0_10px_30px_-8px_rgba(37,99,180,0.35)] transition hover:-translate-y-0.5 hover:border-border-strong hover:bg-surface hover:shadow-[0_14px_36px_-8px_rgba(37,99,180,0.45)]"
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <circle cx="11" cy="11" r="7" />
                    <path d="m21 21-4.3-4.3" />
                  </svg>
                  {t("ctaBrowse")}
                </a>
              </div>
            </div>

            <div className="relative z-10 mx-auto mt-6 grid max-w-2xl grid-cols-4 gap-x-2 font-mono text-sm xl:flex xl:max-w-none xl:flex-wrap xl:justify-center xl:gap-x-12 xl:gap-y-5 xl:border-t xl:border-border xl:pt-9 xl:mt-24">
              {/* 数字はすべてDBの実データ（架空の数字は景品表示法上のリスクがあるため使わない） */}
              <Stat label={t("statPublished")} value={formatStat(stats.tools, locale)} />
              <Stat label={t("statDevelopers")} value={formatStat(stats.developers, locale)} />
              <Stat label={t("statDownloads")} value={formatStat(stats.downloads, locale)} />
              <Stat label={t("statPayoutRate")} value="80%" accent />
            </div>
          </div>
        </section>

        <LiveVisitorsWave />

        {/* Category rail */}
        <section className="border-b border-border">
          <div className="mx-auto max-w-7xl px-6 pb-8 pt-10">
            <h2 className="font-display text-3xl font-semibold text-text-primary sm:text-4xl">
              {t("browseHeading")}
            </h2>
            <p className="mt-2 text-[14px] text-text-muted">
              {t("browseHeadingSub")}
            </p>
            {/* スマホでは27個が縦に10行以上並んでしまうため、3段に並べて横にスワイプする形にする。
                右端をフェードさせ、横に続きがあることが分かるようにしている。PCは従来どおり折り返し */}
            <div className="relative -mx-6 mt-5 sm:mx-0">
              <div className="grid auto-cols-max grid-flow-col grid-rows-3 gap-2 overflow-x-auto px-6 pb-1 [scrollbar-width:none] sm:flex sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0 [&::-webkit-scrollbar]:hidden">
                <CategoryPill label={t("categoryAll")} href="/browse" active />
                {categories.map((c) => (
                  <CategoryPill
                    key={c}
                    label={tCategories(categoryToSlug(c))}
                    href={`/browse?category=${encodeURIComponent(c)}`}
                  />
                ))}
              </div>
              <div
                aria-hidden
                className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-bg to-transparent sm:hidden"
              />
            </div>
          </div>
        </section>

        {/* セール中 */}
        {saleTools.length > 0 && (
          <section className="border-y border-border bg-accent-danger/[0.03]">
            <div className="mx-auto max-w-7xl px-6 py-14">
              <div className="mb-6 flex items-center gap-2.5">
                <span className="flex items-center gap-1 rounded-full bg-accent-danger px-2.5 py-1 font-mono text-[11px] font-semibold text-white">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" />
                  </svg>
                  SALE
                </span>
                <h2 className="font-display text-2xl font-semibold text-text-primary sm:text-3xl">
                  {t("onSale")}
                </h2>
              </div>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {saleTools.map((tool) => (
                  <ToolCard key={tool.id} tool={tool} />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Listing（公開中のツールが1件も無いときは欄ごと出さない） */}
        {tools.length > 0 && (
          <section className="mx-auto max-w-7xl px-6 py-14">
            <div className="mb-6 flex items-baseline justify-between">
              <h2 className="font-display text-3xl font-semibold text-text-primary sm:text-4xl">
                {t("newTools")}
              </h2>
              <a href="/browse" className="text-[13px] text-text-muted hover:text-text-primary">
                {t("viewAll")}
              </a>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {tools.map((tool) => (
                <ToolCard key={tool.id} tool={tool} />
              ))}
            </div>
          </section>
        )}

        {/* BuildBay Creativeへの導線。Creativeページと同じ「白地に虹色のぼかし＋ロゴ」で、
            BuildBay本体と地続きのまま「この先はCreativeの場所」だと分かるようにする */}
        <section className="relative overflow-hidden border-y border-border bg-bg">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute -left-20 -top-24 h-80 w-80 rounded-full bg-[#e91ecf] opacity-25 blur-[100px]" />
            <div className="absolute left-[30%] -top-28 h-72 w-72 rounded-full bg-[#ff8a00] opacity-20 blur-[100px]" />
            <div className="absolute right-[20%] top-[10%] h-72 w-72 rounded-full bg-[#ffd400] opacity-25 blur-[100px]" />
            <div className="absolute -right-16 bottom-[-6rem] h-80 w-80 rounded-full bg-[#06b6d4] opacity-25 blur-[100px]" />
            <div className="absolute left-[40%] bottom-[-8rem] h-80 w-80 rounded-full bg-[#3b5bff] opacity-20 blur-[100px]" />
          </div>

          <div className="relative mx-auto max-w-7xl px-6 py-16">
            <div className="flex flex-col items-start gap-10 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/creative-logo.png" alt="BuildBay Creative" width={1400} height={206} className="h-auto w-full max-w-sm" />
                <p className="mt-5 font-display text-xl font-semibold leading-snug [word-break:auto-phrase] text-text-primary sm:text-2xl">
                  {tCreative("promo.title")}
                </p>
                <p className="mt-3 text-[14px] leading-relaxed text-text-secondary">{tCreative("promo.body")}</p>
                <Link
                  href="/creative"
                  className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#e91ecf] via-[#ff5a36] to-[#06b6d4] px-6 py-3 text-[14px] font-medium text-white shadow-[0_10px_30px_-8px_rgba(233,30,207,0.45)] transition hover:-translate-y-0.5 hover:brightness-110"
                >
                  {tCreative("promo.cta")}
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </Link>
              </div>

              <div className="grid w-full grid-cols-4 gap-3 lg:w-auto">
                {CREATIVE_APPS.map((app) => (
                  <div
                    key={app.slug}
                    className="flex flex-col items-center gap-2 rounded-xl border border-border bg-bg/70 px-3 py-4 backdrop-blur"
                  >
                    <span
                      className="flex h-9 w-9 items-center justify-center rounded-full text-[11px] font-bold text-white"
                      style={{ backgroundColor: app.color }}
                    >
                      {app.shortLabel}
                    </span>
                    <span className="text-center text-[10px] leading-tight text-text-muted">{app.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* BuildBay Academyへの導線。Creativeの紹介欄と同じ作りで、背景だけを
            Academyの緑と金のぼかしにして、2つの特設ページが対になって見えるようにする */}
        <section className="relative overflow-hidden border-b border-border bg-bg">
          <AcademyBlurs />
          <div className="relative mx-auto max-w-7xl px-6 py-16">
            <div className="flex flex-col items-start gap-10 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/academy-logo.png" alt="BuildBay Academy" width={1400} height={182} className="h-auto w-full max-w-sm" />
                <p className="mt-5 font-display text-xl font-semibold leading-snug [word-break:auto-phrase] text-text-primary sm:text-2xl">
                  {tAcademy("promo.title")}
                </p>
                <p className="mt-3 text-[14px] leading-relaxed text-text-secondary">{tAcademy("promo.body")}</p>
                <Link
                  href="/academy"
                  className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#173F35] via-[#2f7a5b] to-[#C9A227] px-6 py-3 text-[14px] font-medium text-white shadow-[0_10px_30px_-8px_rgba(23,63,53,0.45)] transition hover:-translate-y-0.5 hover:brightness-110"
                >
                  {tAcademy("promo.cta")}
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </Link>
              </div>

              <div className="grid w-full grid-cols-4 gap-3 lg:w-auto">
                {COURSE_CATEGORIES.map((cat) => (
                  <Link
                    key={cat}
                    href={`/academy?category=${cat}#courses`}
                    className="flex flex-col items-center gap-2 rounded-xl border border-border bg-bg/70 px-3 py-4 backdrop-blur transition hover:border-[#C9A227]"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#173F35] text-[#e8c65a]">
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d={CATEGORY_ICONS[cat]} />
                      </svg>
                    </span>
                    <span className="text-center text-[10px] leading-tight text-text-muted">
                      {tAcademy(`categories.${cat}.name`)}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Feed preview */}
        {feedPreview.length > 0 && (
          <section className="border-t border-border bg-surface/40">
            <div className="mx-auto max-w-2xl px-6 py-14">
              <div className="mb-6 flex items-baseline justify-between">
                <div>
                  <h2 className="font-display text-3xl font-semibold text-text-primary sm:text-4xl">
                    {t("feedSectionHeading")}
                  </h2>
                  <p className="mt-1 text-[13px] text-text-muted">{t("feedSectionSub")}</p>
                </div>
                <Link href="/feed" className="shrink-0 text-[13px] text-text-muted hover:text-text-primary">
                  {t("viewAll")}
                </Link>
              </div>

              <HomeFeedPreview initialPosts={feedPreview} isLoggedIn={isLoggedIn} />
            </div>
          </section>
        )}

        {/* Requests preview */}
        {requestsPreview.length > 0 && (
          <section className="border-t border-border">
            <div className="mx-auto max-w-2xl px-6 py-14">
              <div className="mb-6 flex items-baseline justify-between">
                <div>
                  <h2 className="font-display text-3xl font-semibold text-text-primary sm:text-4xl">
                    {t("requestsSectionHeading")}
                  </h2>
                  <p className="mt-1 text-[13px] text-text-muted">{t("requestsSectionSub")}</p>
                </div>
                <Link href="/requests" className="shrink-0 text-[13px] text-text-muted hover:text-text-primary">
                  {t("viewAll")}
                </Link>
              </div>

              <HomeRequestsPreview initialRequests={requestsPreview} isLoggedIn={isLoggedIn} />
            </div>
          </section>
        )}
      </main>

      <Footer />
    </>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1 text-center xl:items-start xl:text-left">
      <span className={`text-base xl:text-lg font-medium ${accent ? "text-accent-signal" : "text-text-primary"}`}>
        {value}
      </span>
      <span className="text-[11px] leading-tight text-text-dim xl:text-sm">{label}</span>
    </div>
  );
}

const FLOAT_ICON_STYLES = [
  "bg-[#16232d] text-white",
  "bg-accent-signal-dim text-accent-signal",
  "bg-accent-ai-dim text-accent-ai",
  "bg-surface-raised text-text-secondary",
];

function MobileFloatingCard({
  tool,
  className,
  freeLabel,
}: {
  tool: Tool;
  className: string;
  freeLabel: string;
}) {
  return (
    <a
      href={`/apps/${tool.slug}`}
      className={`absolute z-[5] w-40 rounded-2xl border border-border bg-bg/95 p-3 shadow-[0_16px_34px_-12px_rgba(30,78,150,0.35)] backdrop-blur-sm transition active:scale-[0.97] ${className}`}
    >
      <span
        className={`absolute right-2.5 top-2.5 rounded-full px-1.5 py-0.5 font-mono text-[9px] tracking-wide ${
          tool.runtime === "local"
            ? "bg-accent-ai-dim text-accent-ai"
            : "bg-surface-raised text-text-muted"
        }`}
      >
        {tool.runtime === "local" ? "LOCAL" : "CLOUD"}
      </span>

      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-surface-raised to-surface">
        {tool.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={tool.thumbnailUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="font-display text-[13px] font-semibold text-accent-ai">
            {tool.name.slice(0, 1)}
          </span>
        )}
      </div>

      <p className="mt-2 truncate pr-8 text-[13px] font-semibold leading-tight text-text-primary">
        {tool.name}
      </p>
      <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-text-secondary">
        {tool.tagline}
      </p>

      <div className="mt-2 flex items-center justify-between">
        <span className="flex items-center gap-1 text-[11px] text-text-muted">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v12m0 0 4-4m-4 4-4-4M4 19h16" />
          </svg>
          {formatInstalls(tool.installs)}
        </span>
        <span className="text-[11px] font-semibold text-accent-signal">
          {tool.price === 0 ? freeLabel : `¥${tool.price.toLocaleString()}`}
        </span>
      </div>
    </a>
  );
}

function FloatingCard({
  tool,
  index,
  className,
  anim,
  duration,
  tCategories,
  freeLabel,
}: {
  tool: Tool;
  index: number;
  className: string;
  anim: "float-a" | "float-b" | "float-c" | "float-d";
  duration: string;
  tCategories: Awaited<ReturnType<typeof getTranslations>>;
  freeLabel: string;
}) {
  const initials = tool.author.name
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2);

  return (
    <a
      href={`/apps/${tool.slug}`}
      data-float
      style={{ animation: `${anim} ${duration} ease-in-out infinite` }}
      className={`absolute z-10 w-72 overflow-hidden rounded-2xl border border-border bg-bg/95 shadow-[0_24px_50px_-14px_rgba(30,78,150,0.38)] backdrop-blur-sm transition hover:border-border-strong hover:shadow-[0_28px_58px_-14px_rgba(30,78,150,0.48)] ${className}`}
    >
      {/* サムネイル */}
      <div className="relative aspect-video overflow-hidden bg-gradient-to-br from-surface-raised to-surface">
        {tool.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={tool.thumbnailUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span
            className={`flex h-full w-full items-center justify-center font-display text-2xl font-semibold ${FLOAT_ICON_STYLES[index % FLOAT_ICON_STYLES.length]}`}
          >
            {tool.name.slice(0, 1)}
          </span>
        )}
        <span
          className={`absolute right-2.5 top-2.5 rounded-full px-2 py-0.5 font-mono text-[10px] tracking-wide ${
            tool.runtime === "local"
              ? "bg-accent-ai-dim text-accent-ai"
              : "bg-bg/90 text-text-muted"
          }`}
        >
          {tool.runtime === "local" ? "LOCAL" : "CLOUD"}
        </span>
      </div>

      <div className="p-4">
        <p className="font-display text-[15px] font-semibold leading-tight text-text-primary">
          {tool.name}
        </p>
        <p className="mt-1.5 line-clamp-2 text-[13px] leading-snug text-text-secondary">
          {tool.tagline}
        </p>

        {/* カテゴリ */}
        {tool.categories.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1">
            {tool.categories.slice(0, 2).map((c) => (
              <span
                key={c}
                className="rounded-full bg-surface-raised px-2 py-0.5 text-[10px] text-text-muted"
              >
                {tCategories(categoryToSlug(c))}
              </span>
            ))}
            {tool.categories.length > 2 && (
              <span className="text-[10px] text-text-dim">
                +{tool.categories.length - 2}
              </span>
            )}
          </div>
        )}

        {/* 出品者 */}
        <div className="mt-2.5 flex items-center gap-1.5">
          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-ai-dim text-[9px] font-semibold text-accent-ai">
            {initials}
          </div>
          <span className="truncate text-[12px] text-text-muted">{tool.author.name}</span>
        </div>

        <div className="mt-3 flex items-center justify-between font-mono text-[12px] text-text-dim">
          <span className="flex items-center gap-2.5">
            <span className="flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3v12" />
                <path d="m7 10 5 5 5-5" />
                <path d="M5 21h14" />
              </svg>
              {formatInstalls(tool.installs)}
            </span>
            {tool.likes > 0 && (
              <span className="flex items-center gap-1">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" className="text-accent-signal">
                  <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 1 0-7.8 7.8l1.1 1L12 21l7.7-7.7 1.1-1a5.5 5.5 0 0 0 0-7.8Z" />
                </svg>
                {tool.likes}
              </span>
            )}
            <span className="flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" />
                <circle cx="12" cy="12" r="2.5" />
              </svg>
              {formatInstalls(tool.views)}
            </span>
          </span>
          <span className={tool.price === 0 ? "text-text-muted" : "text-accent-signal"}>
            {formatPrice(tool.price, freeLabel)}
          </span>
        </div>
      </div>
    </a>
  );
}

function CategoryPill({
  label,
  active,
  href,
}: {
  label: string;
  active?: boolean;
  href: string;
}) {
  return (
    <Link
      href={href}
      className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-[12px] transition sm:px-4 sm:py-1.5 sm:text-[13px] ${
        active
          ? "border-accent-signal/40 bg-accent-signal-dim text-accent-signal"
          : "border-border text-text-secondary hover:border-border-strong hover:text-text-primary"
      }`}
    >
      {label}
    </Link>
  );
}
