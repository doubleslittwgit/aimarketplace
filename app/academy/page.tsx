import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import CourseCard, { type CourseCardData } from "@/components/academy/CourseCard";
import {
  COURSE_CATEGORIES,
  CATEGORY_ICONS,
  isCourseCategory,
  type CourseCategory,
} from "@/lib/academy/categories";
import type { JSONNode, TocItem } from "@/lib/course-content";

export async function generateMetadata() {
  const t = await getTranslations("academyHome");
  return { title: t("meta.title"), description: t("meta.description") };
}

type CourseRow = {
  id: string;
  slug: string;
  title: string;
  thumbnail_url: string | null;
  price: number;
  toc: TocItem[] | null;
  free_content: JSONNode | null;
  author_id: string;
  category: string | null;
  profiles: { display_name: string | null; handle: string | null } | null;
};

function countH2(doc: JSONNode | null): number {
  return (doc?.content ?? []).filter((b) => b.type === "heading" && b.attrs?.level !== 3).length;
}

/**
 * 公開中の講座を取得し、カード表示用の形に整える。
 * 「本人確認済み」の判定元（seller_accounts）は非公開なので、管理者権限で
 * 真偽だけを取り出す（口座情報などは一切画面に渡さない）。
 */
async function loadCourses(filter: { q?: string; category?: CourseCategory }) {
  const supabase = await createClient();
  let query = supabase
    .from("courses")
    .select(
      "id, slug, title, thumbnail_url, price, toc, free_content, author_id, category, profiles:author_id(display_name, handle)"
    )
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(40);

  if (filter.q) {
    // 検索語に含まれるワイルドカード記号は、ただの文字として扱う
    const safe = filter.q.replace(/[%_\\]/g, "").slice(0, 50);
    if (safe) query = query.ilike("title", `%${safe}%`);
  }
  if (filter.category) query = query.eq("category", filter.category);

  const { data } = await query;
  const rows = (data ?? []) as unknown as CourseRow[];
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const authorIds = Array.from(new Set(rows.map((r) => r.author_id)));

  const [{ data: links }, { data: accounts }] = await Promise.all([
    supabase.from("course_tool_links").select("course_id").in("course_id", ids),
    createAdminClient()
      .from("seller_accounts")
      .select("user_id, transfers_enabled, payouts_enabled")
      .in("user_id", authorIds),
  ]);
  const makerIds = new Set((links ?? []).map((l) => l.course_id));
  const verifiedIds = new Set(
    (accounts ?? []).filter((a) => a.transfers_enabled && a.payouts_enabled).map((a) => a.user_id)
  );

  return rows.map((r): CourseCardData & { byMaker: boolean } => {
    const toc = r.toc ?? [];
    const h2 = toc.filter((x) => x.level === 2).length;
    return {
      slug: r.slug,
      title: r.title,
      thumbnailUrl: r.thumbnail_url,
      price: r.price,
      authorName: r.profiles?.display_name || r.profiles?.handle || "—",
      verified: verifiedIds.has(r.author_id),
      byMaker: makerIds.has(r.id),
      chapters: h2 || toc.length,
      freeChapters: countH2(r.free_content),
      hasPaywall: (r.free_content?.content ?? []).length > 0,
    };
  });
}

/* ------------------------------------------------------------------ */

function Icon({ d, size = 20 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

const BOOK = "M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14zM20 17v4H6.5a2.5 2.5 0 0 1 0-5";
const ARROW = "M5 12h14M13 6l6 6-6 6";
const PEN = "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z";

function SectionTitle({ title, sub, icon }: { title: string; sub?: string; icon?: string }) {
  return (
    <div className="mb-5 flex flex-wrap items-baseline gap-x-4 gap-y-1">
      <h2 className="ac-serif flex items-center gap-2 text-[22px] font-bold text-[#173F35] sm:text-[26px]">
        {icon && (
          <span className="text-[#C9A227]">
            <Icon d={icon} size={22} />
          </span>
        )}
        {title}
      </h2>
      {sub && <p className="text-[13px] text-[#5E6A62]">{sub}</p>}
    </div>
  );
}

function CourseGrid({ courses }: { courses: CourseCardData[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
      {courses.map((c) => (
        <CourseCard key={c.slug} course={c} />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */

export default async function AcademyHomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const t = await getTranslations("academyHome");
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const category = isCourseCategory(sp.category) ? sp.category : undefined;
  const filtering = Boolean(q || category);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const courses = await loadCourses({ q: q || undefined, category });
  const makerCourses = courses.filter((c) => c.byMaker).slice(0, 5);
  const newCourses = courses.slice(0, 10);

  const writeHref = user ? "/academy/new" : "/login?next=/academy/new";

  return (
    <div className="min-h-screen bg-[#F7F3E8] text-[#1D2B25]">
      {/* ================= ヘッダー ================= */}
      <header className="sticky top-0 z-40 border-b border-[#E6DFCC] bg-[#F7F3E8]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
          <Link href="/academy" className="flex shrink-0 items-center gap-2 text-[#173F35]">
            <span className="text-[#C9A227]">
              <Icon d={BOOK} size={26} />
            </span>
            <span className="leading-tight">
              <span className="ac-serif block text-[18px] font-bold">BuildBay Academy</span>
              <span className="block text-[10px] tracking-wide text-[#5E6A62]">{t("tagline")}</span>
            </span>
          </Link>

          <nav className="ml-4 hidden items-center gap-5 text-[13px] text-[#34463D] lg:flex">
            <a href="#courses" className="hover:text-[#173F35]">{t("nav.browse")}</a>
            <a href="#categories" className="hover:text-[#173F35]">{t("nav.categories")}</a>
            <a href="#makers" className="hover:text-[#173F35]">{t("nav.makers")}</a>
          </nav>

          <form action="/academy" method="get" className="ml-auto hidden max-w-sm flex-1 md:block">
            <label className="flex items-center gap-2 rounded-full border border-[#E6DFCC] bg-white px-4 py-2">
              <span className="text-[#8A8F84]">
                <Icon d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3" size={16} />
              </span>
              <input
                name="q"
                defaultValue={q}
                placeholder={t("searchPlaceholder")}
                className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-[#9AA098]"
              />
            </label>
          </form>

          <div className="ml-auto flex shrink-0 items-center gap-3 md:ml-0">
            <Link href="/" className="hidden text-[12px] text-[#5E6A62] hover:text-[#173F35] sm:inline">
              {t("nav.backToBuildBay")}
            </Link>
            {!user && (
              <Link href="/login?next=/academy" className="text-[13px] text-[#34463D] hover:text-[#173F35]">
                {t("login")}
              </Link>
            )}
            <Link
              href={writeHref}
              className="rounded-lg bg-[#C9A227] px-4 py-2 text-[13px] font-semibold text-white shadow-sm transition hover:brightness-105"
            >
              {t("write")}
            </Link>
          </div>
        </div>
      </header>

      {/* ================= ヒーロー ================= */}
      {!filtering && (
        <section className="relative overflow-hidden border-b border-[#E6DFCC]">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-[#C9A227]/10 blur-3xl"
          />
          <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:py-20">
            <div>
              <h1 className="ac-serif text-[40px] font-bold leading-[1.25] text-[#173F35] sm:text-[56px]">
                {t("hero.titleA")}
                <span className="text-[#C9A227]">{t("hero.titleGold")}</span>
                {t("hero.titleB")}
                <br />
                {t("hero.titleLine2")}
              </h1>
              <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-[#34463D]">
                {t("hero.description")}
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <a
                  href="#courses"
                  className="inline-flex items-center gap-2 rounded-full bg-[#173F35] px-6 py-3 text-[14px] font-semibold text-[#F7F3E8] transition hover:brightness-110"
                >
                  {t("hero.ctaBrowse")}
                  <Icon d={ARROW} size={16} />
                </a>
                <Link
                  href={writeHref}
                  className="inline-flex items-center gap-2 rounded-full border-2 border-[#C9A227] bg-white/60 px-6 py-3 text-[14px] font-semibold text-[#173F35] transition hover:bg-white"
                >
                  <Icon d={PEN} size={16} />
                  {t("hero.ctaWrite")}
                </Link>
              </div>
              {/* 架空の実績数字ではなく、仕組みとして約束できることを並べる */}
              <dl className="mt-9 grid max-w-xl grid-cols-3 gap-4">
                {(["toc", "free", "fee"] as const).map((k) => (
                  <div key={k} className="border-l-2 border-[#C9A227] pl-3">
                    <dt className="ac-serif text-[17px] font-bold text-[#173F35]">{t(`hero.points.${k}.value`)}</dt>
                    <dd className="mt-0.5 text-[11px] leading-snug text-[#5E6A62]">{t(`hero.points.${k}.label`)}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* 右側：「有料ライン」付きの講座プレビュー（BuildBay Academyの特徴を絵で見せる） */}
            <div className="relative mx-auto w-full max-w-md">
              <div className="rounded-2xl bg-[#173F35] p-5 shadow-[0_30px_60px_-25px_rgba(23,63,53,0.6)] sm:p-7">
                <div className="rounded-xl bg-[#FFFDF7] p-5">
                  <div className="h-24 rounded-lg bg-gradient-to-br from-[#1F4F43] to-[#173F35]" />
                  <p className="ac-serif mt-4 text-[16px] font-bold text-[#173F35]">{t("hero.preview.title")}</p>
                  <p className="mt-3 text-[11px] font-semibold tracking-wider text-[#9C7A12]">{t("hero.preview.toc")}</p>
                  <ul className="mt-1.5 space-y-1.5 text-[12px] text-[#34463D]">
                    {[1, 2, 3].map((n) => (
                      <li key={n} className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#C9A227]" />
                        {t("hero.preview.chapter", { n })}
                      </li>
                    ))}
                  </ul>
                  <div className="relative my-4 border-t-2 border-dashed border-[#C9A227]">
                    <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#C9A227] bg-[#FFFDF7] px-3 py-0.5 text-[10px] font-bold text-[#9C7A12]">
                      {t("hero.preview.paywall")}
                    </span>
                  </div>
                  <div className="space-y-2 opacity-60 blur-[1.5px]">
                    <div className="h-2 w-full rounded bg-[#E6DFCC]" />
                    <div className="h-2 w-5/6 rounded bg-[#E6DFCC]" />
                    <div className="h-2 w-4/6 rounded bg-[#E6DFCC]" />
                  </div>
                </div>
              </div>
              <div className="absolute -left-4 top-8 hidden rounded-xl border border-[#E6DFCC] bg-white px-4 py-2.5 shadow-lg sm:block">
                <p className="text-[12px] font-bold text-[#173F35]">{t("hero.preview.article")}</p>
                <p className="text-[10px] text-[#5E6A62]">{t("hero.preview.articleSub")}</p>
              </div>
              <div className="absolute -right-4 bottom-10 hidden rounded-xl border border-[#E6DFCC] bg-white px-4 py-2.5 shadow-lg sm:block">
                <p className="text-[12px] font-bold text-[#173F35]">{t("hero.preview.video")}</p>
                <p className="text-[10px] text-[#5E6A62]">{t("hero.preview.videoSub")}</p>
              </div>
            </div>
          </div>
        </section>
      )}

      <main className="mx-auto max-w-7xl px-4 sm:px-6">
        {/* ================= カテゴリ ================= */}
        <section id="categories" className="scroll-mt-20 py-10">
          <SectionTitle title={t("sections.categories")} />
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-8">
            {COURSE_CATEGORIES.map((c) => {
              const active = category === c;
              return (
                <Link
                  key={c}
                  href={active ? "/academy" : `/academy?category=${c}#courses`}
                  className={`flex items-center gap-2.5 rounded-xl border px-3 py-3 transition ${
                    active
                      ? "border-[#173F35] bg-[#173F35] text-[#F7F3E8]"
                      : "border-[#E6DFCC] bg-white text-[#1D2B25] hover:border-[#C9A227]"
                  }`}
                >
                  <span className={active ? "text-[#C9A227]" : "text-[#C9A227]"}>
                    <Icon d={CATEGORY_ICONS[c]} size={20} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[12px] font-bold">{t(`categories.${c}.name`)}</span>
                    <span className={`block truncate text-[10px] ${active ? "text-[#F7F3E8]/70" : "text-[#8A8F84]"}`}>
                      {t(`categories.${c}.desc`)}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        {/* ================= 講座一覧（検索中は結果を表示） ================= */}
        <section id="courses" className="scroll-mt-20 pb-12">
          {filtering ? (
            <>
              <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
                <SectionTitle
                  title={
                    q
                      ? t("sections.resultsFor", { q })
                      : t("sections.categoryResults", { name: t(`categories.${category}.name`) })
                  }
                />
                <Link href="/academy" className="text-[13px] text-[#9C7A12] hover:underline">
                  {t("sections.clearFilter")}
                </Link>
              </div>
              {courses.length > 0 ? (
                <CourseGrid courses={courses} />
              ) : (
                <p className="rounded-xl border border-dashed border-[#D9CFB5] bg-white/60 py-10 text-center text-[13px] text-[#5E6A62]">
                  {t("sections.noResults")}
                </p>
              )}
            </>
          ) : (
            <>
              <SectionTitle
                title={t("sections.newTitle")}
                sub={t("sections.newSub")}
                icon="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z"
              />
              {newCourses.length > 0 ? (
                <CourseGrid courses={newCourses} />
              ) : (
                // まだ講座が1件も無い段階の表示。空の棚を見せる代わりに、最初の書き手を募る
                <div className="flex flex-col items-center rounded-2xl border border-dashed border-[#D9CFB5] bg-white/70 px-6 py-14 text-center">
                  <span className="text-[#C9A227]">
                    <Icon d={BOOK} size={36} />
                  </span>
                  <p className="ac-serif mt-3 text-[20px] font-bold text-[#173F35]">{t("empty.title")}</p>
                  <p className="mt-2 max-w-md text-[13px] leading-relaxed text-[#5E6A62]">{t("empty.body")}</p>
                  <Link
                    href={writeHref}
                    className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#C9A227] px-6 py-2.5 text-[14px] font-semibold text-white transition hover:brightness-105"
                  >
                    {t("empty.cta")}
                    <Icon d={ARROW} size={16} />
                  </Link>
                </div>
              )}
            </>
          )}
        </section>
      </main>

      {/* ================= 作った人が教える講座 ================= */}
      {!filtering && (
        <section id="makers" className="scroll-mt-20 border-y border-[#E6DFCC] bg-[#EFE8D6]">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[18rem_1fr]">
            <div>
              <h2 className="ac-serif flex items-center gap-2 text-[26px] font-bold text-[#173F35]">
                <span className="text-[#C9A227]">
                  <Icon d={PEN} size={24} />
                </span>
                {t("sections.makersTitle")}
              </h2>
              <p className="mt-3 text-[13px] leading-relaxed text-[#34463D]">{t("sections.makersSub")}</p>
              <p className="ac-serif mt-6 text-[17px] italic text-[#9C7A12]">{t("sections.makersQuote")}</p>
            </div>
            {makerCourses.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
                {makerCourses.map((c) => (
                  <CourseCard key={c.slug} course={c} />
                ))}
              </div>
            ) : (
              <div className="flex items-center rounded-2xl border border-dashed border-[#D9CFB5] bg-white/60 p-6 text-[13px] leading-relaxed text-[#5E6A62]">
                {t("sections.makersEmpty")}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ================= 安心して買える理由 ================= */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <SectionTitle
          title={t("trust.title")}
          sub={t("trust.sub")}
          icon="M12 2 3 6v6c0 5 3.8 9.3 9 10 5.2-.7 9-5 9-10V6l-9-4Z"
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              ["review", "M20 6 9 17l-5-5"],
              ["toc", "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h8"],
              ["free", BOOK],
              ["refund", "M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11"],
            ] as const
          ).map(([k, icon]) => (
            <div key={k} className="flex gap-3 rounded-xl border border-[#E6DFCC] bg-white p-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F7F3E8] text-[#C9A227]">
                <Icon d={icon} size={20} />
              </span>
              <div>
                <p className="text-[14px] font-bold text-[#173F35]">{t(`trust.${k}.title`)}</p>
                <p className="mt-1 text-[12px] leading-relaxed text-[#5E6A62]">{t(`trust.${k}.body`)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ================= 講座を書く人向けの案内 ================= */}
      <section className="border-t border-[#E6DFCC] bg-gradient-to-r from-[#F7F3E8] to-[#EFE8D6]">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-12 sm:px-6 lg:flex-row lg:items-center">
          <div className="flex-1">
            <h2 className="ac-serif text-[24px] font-bold text-[#173F35] sm:text-[28px]">{t("creator.title")}</h2>
            <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-[#34463D]">{t("creator.body")}</p>
          </div>
          <Link
            href={writeHref}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-[#C9A227] px-8 py-3.5 text-[15px] font-bold text-white shadow-md transition hover:brightness-105"
          >
            {t("creator.cta")}
            <Icon d={ARROW} size={18} />
          </Link>
          <div className="flex shrink-0 gap-6">
            {(["fee", "id"] as const).map((k) => (
              <div key={k} className="border-l-2 border-[#C9A227] pl-3">
                <p className="text-[11px] text-[#5E6A62]">{t(`creator.${k}Label`)}</p>
                <p className="ac-serif text-[18px] font-bold text-[#173F35]">{t(`creator.${k}Value`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= フッター ================= */}
      <footer className="bg-[#173F35] text-[#F7F3E8]">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-10 sm:px-6 md:flex-row md:justify-between">
          <div>
            <p className="ac-serif flex items-center gap-2 text-[18px] font-bold">
              <span className="text-[#C9A227]">
                <Icon d={BOOK} size={22} />
              </span>
              BuildBay Academy
            </p>
            <p className="mt-1 text-[12px] text-[#F7F3E8]/70">{t("tagline")}</p>
          </div>
          <div className="grid grid-cols-2 gap-x-12 gap-y-2 text-[12px] text-[#F7F3E8]/80">
            <a href="#courses" className="hover:text-white">{t("nav.browse")}</a>
            <Link href="/legal/terms" className="hover:text-white">{t("footer.terms")}</Link>
            <Link href={writeHref} className="hover:text-white">{t("write")}</Link>
            <Link href="/legal/privacy" className="hover:text-white">{t("footer.privacy")}</Link>
            <Link href="/" className="hover:text-white">{t("nav.backToBuildBay")}</Link>
            <Link href="/legal/tokushoho" className="hover:text-white">{t("footer.tokushoho")}</Link>
            <span />
            <Link href="/legal/contact" className="hover:text-white">{t("footer.contact")}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
