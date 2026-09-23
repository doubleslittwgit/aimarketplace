import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import CourseCard, { type CourseCardData } from "@/components/academy/CourseCard";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AcademyBlurs from "@/components/academy/AcademyBlurs";
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
      <h2 className="font-display flex items-center gap-2 text-[22px] font-bold text-text-primary sm:text-[26px]">
        {icon && (
          <span className="text-[#C9A227]">
            <Icon d={icon} size={22} />
          </span>
        )}
        {title}
      </h2>
      {sub && <p className="text-[13px] text-text-muted">{sub}</p>}
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
    <div className="flex min-h-screen flex-col bg-bg text-text-primary">
      <Header />

      {/* ================= ヒーロー（白地に緑と金のぼかし） ================= */}
      {!filtering && (
        <section className="relative overflow-hidden border-b border-border bg-bg">
          <AcademyBlurs />
          <div className="relative mx-auto max-w-7xl px-6 py-16 sm:py-24">
            <div className="max-w-2xl">
              <h1 className="sr-only">BuildBay Academy</h1>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/academy-logo.png"
                alt="BuildBay Academy"
                width={1400}
                height={182}
                className="h-auto w-full max-w-xl"
              />
              <p className="mt-8 font-display text-2xl font-semibold leading-snug text-text-primary sm:text-3xl">
                {t("hero.titleA")}
                <span className="text-[#9C7A12]">{t("hero.titleGold")}</span>
                {t("hero.titleB")}
                {t("hero.titleLine2")}
              </p>
              <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-text-secondary sm:text-base">
                {t("hero.description")}
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-4">
                <a
                  href="#courses"
                  className="flex items-center gap-2 rounded-full bg-accent-signal px-7 py-3.5 text-[15px] font-medium text-white shadow-[0_10px_30px_-6px_rgba(255,107,74,0.55)] transition hover:-translate-y-0.5 hover:brightness-110"
                >
                  <Icon d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3" size={17} />
                  {t("hero.ctaBrowse")}
                </a>
                <Link
                  href={writeHref}
                  className="flex items-center gap-2 rounded-full border border-border bg-bg/80 px-7 py-3.5 text-[15px] font-medium text-text-primary shadow-[0_10px_30px_-8px_rgba(23,63,53,0.35)] backdrop-blur transition hover:-translate-y-0.5 hover:border-border-strong hover:bg-bg"
                >
                  <Icon d={PEN} size={17} />
                  {t("hero.ctaWrite")}
                </Link>
              </div>
              {/* 架空の実績数字ではなく、仕組みとして約束できることを並べる */}
              <dl className="mt-10 grid max-w-xl grid-cols-3 gap-4">
                {(["toc", "free", "fee"] as const).map((k) => (
                  <div key={k} className="border-l-2 border-[#C9A227] pl-3">
                    <dt className="font-display text-[16px] font-semibold text-text-primary">{t(`hero.points.${k}.value`)}</dt>
                    <dd className="mt-0.5 text-[11px] leading-snug text-text-muted">{t(`hero.points.${k}.label`)}</dd>
                  </div>
                ))}
              </dl>
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
                      : "border-border bg-surface text-text-primary hover:border-[#C9A227]"
                  }`}
                >
                  <span className={active ? "text-[#C9A227]" : "text-[#C9A227]"}>
                    <Icon d={CATEGORY_ICONS[c]} size={20} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[12px] font-bold">{t(`categories.${c}.name`)}</span>
                    <span className={`block truncate text-[10px] ${active ? "text-[#F7F3E8]/70" : "text-text-dim"}`}>
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
          <form action="/academy" method="get" className="mb-8 max-w-md">
            <label className="flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2.5 focus-within:border-border-strong">
              <span className="text-text-dim">
                <Icon d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3" size={16} />
              </span>
              <input
                name="q"
                defaultValue={q}
                placeholder={t("searchPlaceholder")}
                className="min-w-0 flex-1 bg-transparent text-[13px] text-text-primary outline-none placeholder:text-text-dim"
              />
            </label>
          </form>
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
                <p className="rounded-xl border border-dashed border-border-strong bg-surface py-10 text-center text-[13px] text-text-muted">
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
                <div className="flex flex-col items-center rounded-2xl border border-dashed border-border-strong bg-surface px-6 py-14 text-center">
                  <span className="text-[#C9A227]">
                    <Icon d={BOOK} size={36} />
                  </span>
                  <p className="font-display mt-3 text-[20px] font-bold text-text-primary">{t("empty.title")}</p>
                  <p className="mt-2 max-w-md text-[13px] leading-relaxed text-text-muted">{t("empty.body")}</p>
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
        <section id="makers" className="scroll-mt-20 border-y border-border bg-surface">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[18rem_1fr]">
            <div>
              <h2 className="font-display flex items-center gap-2 text-[26px] font-bold text-text-primary">
                <span className="text-[#C9A227]">
                  <Icon d={PEN} size={24} />
                </span>
                {t("sections.makersTitle")}
              </h2>
              <p className="mt-3 text-[13px] leading-relaxed text-text-secondary">{t("sections.makersSub")}</p>
              <p className="font-display mt-6 text-[17px] italic text-[#9C7A12]">{t("sections.makersQuote")}</p>
            </div>
            {makerCourses.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
                {makerCourses.map((c) => (
                  <CourseCard key={c.slug} course={c} />
                ))}
              </div>
            ) : (
              <div className="flex items-center rounded-2xl border border-dashed border-border-strong bg-surface p-6 text-[13px] leading-relaxed text-text-muted">
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
            <div key={k} className="flex gap-3 rounded-xl border border-border bg-surface p-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-bg text-[#C9A227]">
                <Icon d={icon} size={20} />
              </span>
              <div>
                <p className="text-[14px] font-bold text-text-primary">{t(`trust.${k}.title`)}</p>
                <p className="mt-1 text-[12px] leading-relaxed text-text-muted">{t(`trust.${k}.body`)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ================= 講座を書く人向けの案内 ================= */}
      <section className="border-t border-border bg-surface">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-12 sm:px-6 lg:flex-row lg:items-center">
          <div className="flex-1">
            <h2 className="font-display text-[24px] font-bold text-text-primary sm:text-[28px]">{t("creator.title")}</h2>
            <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-text-secondary">{t("creator.body")}</p>
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
                <p className="text-[11px] text-text-muted">{t(`creator.${k}Label`)}</p>
                <p className="font-display text-[18px] font-bold text-text-primary">{t(`creator.${k}Value`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
