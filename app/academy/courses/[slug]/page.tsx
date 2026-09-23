import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AcademyHeader, AcademyFooter, AcIcon } from "@/components/academy/AcademyChrome";
import { renderCourseHtml } from "@/lib/academy/render";
import { isCourseCategory } from "@/lib/academy/categories";
import { COURSE_PURCHASE_ENABLED } from "@/lib/academy/flags";
import type { JSONNode, TocItem } from "@/lib/course-content";

type CourseRow = {
  id: string;
  slug: string;
  title: string;
  thumbnail_url: string | null;
  price: number;
  status: string;
  category: string | null;
  toc: TocItem[] | null;
  free_content: JSONNode | null;
  author_id: string;
  profiles: { display_name: string | null; handle: string | null } | null;
};

const SELECT =
  "id, slug, title, thumbnail_url, price, status, category, toc, free_content, author_id, profiles:author_id(display_name, handle)";

const LOCK = "M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4";
const SHIELD = "M12 2 3 6v6c0 5 3.8 9.3 9 10 5.2-.7 9-5 9-10V6l-9-4Z";

function countHeadings(doc: JSONNode | null): number {
  return (doc?.content ?? []).filter((b) => b.type === "heading").length;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("courses").select("title, status").eq("slug", slug).maybeSingle();
  return { title: data?.title ? `${data.title} | BuildBay Academy` : "BuildBay Academy" };
}

export default async function CoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const t = await getTranslations("academyCourse");
  const tHome = await getTranslations("academyHome");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 通常は公開中のもの（と、作者本人の下書き）だけが読める
  let course = (await supabase.from("courses").select(SELECT).eq("slug", slug).maybeSingle())
    .data as unknown as CourseRow | null;

  // 管理者は、審査のために公開前の講座もプレビューできる
  let isAdmin = false;
  if (user) {
    const { data } = await supabase.rpc("is_admin", { p_user_id: user.id });
    isAdmin = Boolean(data);
  }
  const admin = createAdminClient();
  if (!course && isAdmin) {
    course = (await admin.from("courses").select(SELECT).eq("slug", slug).maybeSingle())
      .data as unknown as CourseRow | null;
  }
  if (!course) notFound();

  const isAuthor = user?.id === course.author_id;
  const isPublished = course.status === "published";
  if (!isPublished && !isAuthor && !isAdmin) notFound();

  // 全文（有料部分を含む）は金庫側にある。読めるのは作者・無料公開の講座（・今後は購入者）。
  // 管理者が他人の講座を審査する場合だけ、管理者権限で読む。
  const bodyReader = isAdmin && !isAuthor ? admin : supabase;
  const { data: body } = await bodyReader
    .from("course_bodies")
    .select("content")
    .eq("course_id", course.id)
    .maybeSingle();
  const fullDoc = (body?.content as JSONNode | undefined) ?? null;
  const hasFullAccess = Boolean(fullDoc) && (course.price === 0 || isAuthor || isAdmin);

  const html = renderCourseHtml(hasFullAccess ? fullDoc : course.free_content);

  const toc = course.toc ?? [];
  const freeHeadingCount = course.price === 0 ? toc.length : countHeadings(course.free_content);
  const lockedCount = toc.length - freeHeadingCount;
  const isPaid = course.price > 0;

  const [{ data: links }, { data: account }] = await Promise.all([
    supabase
      .from("course_tool_links")
      .select("tools(id, slug, name, tagline, thumbnail_url, status)")
      .eq("course_id", course.id),
    // 「本人確認済み」の判定（口座情報は画面に渡さず、真偽だけを使う）
    admin
      .from("seller_accounts")
      .select("transfers_enabled, payouts_enabled")
      .eq("user_id", course.author_id)
      .maybeSingle(),
  ]);
  const verified = Boolean(account?.transfers_enabled && account?.payouts_enabled);
  type LinkedTool = { id: string; slug: string; name: string; tagline: string; thumbnail_url: string | null; status: string };
  const tools = ((links ?? []) as unknown as { tools: LinkedTool | null }[])
    .map((l) => l.tools)
    .filter((x): x is LinkedTool => Boolean(x && x.status === "published"));

  const authorName = course.profiles?.display_name || course.profiles?.handle || "—";
  const category = isCourseCategory(course.category) ? course.category : null;

  const buyBox = (
    <div className="rounded-xl border border-[#E6DFCC] bg-white p-5">
      <p className={`ac-serif text-[26px] font-bold ${isPaid ? "text-[#173F35]" : "text-[#1F7A4D]"}`}>
        {isPaid ? `¥${course.price.toLocaleString()}` : tHome("card.free")}
      </p>
      {!isPaid ? (
        <p className="mt-2 text-[13px] text-[#5E6A62]">{t("freeNote")}</p>
      ) : hasFullAccess ? (
        <p className="mt-2 rounded-lg bg-[#F7F3E8] px-3 py-2 text-[12px] text-[#5E6A62]">
          {isAuthor ? t("authorPreview") : t("adminPreview")}
        </p>
      ) : (
        <>
          <button
            type="button"
            disabled={!COURSE_PURCHASE_ENABLED}
            className="mt-3 w-full rounded-lg bg-[#C9A227] py-3 text-[14px] font-bold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {COURSE_PURCHASE_ENABLED ? t("buy") : t("buyComingSoon")}
          </button>
          <p className="mt-2 text-[11px] text-[#8A8F84]">{t("buyNote")}</p>
        </>
      )}
      <ul className="mt-4 space-y-1.5 border-t border-[#EFE9D8] pt-4 text-[12px] text-[#34463D]">
        <li>{tHome("card.chapters", { n: toc.filter((x) => x.level === 2).length || toc.length })}</li>
        {isPaid && lockedCount > 0 && <li>{t("lockedCount", { n: lockedCount })}</li>}
      </ul>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F7F3E8] text-[#1D2B25]">
      <AcademyHeader isLoggedIn={Boolean(user)} />

      {!isPublished && (
        <div className="border-b border-[#C9A227]/40 bg-[#C9A227]/10 px-4 py-2.5 text-center text-[13px] text-[#6B5510]">
          {t(`statusBanner.${course.status}`)}
          {isAuthor && (
            <Link href={`/academy/${course.id}/edit`} className="ml-2 font-semibold underline">
              {t("editCourse")}
            </Link>
          )}
        </div>
      )}

      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_20rem]">
        {/* ------- 本文側 ------- */}
        <article className="min-w-0">
          {category && (
            <Link
              href={`/academy?category=${category}#courses`}
              className="text-[12px] font-semibold text-[#9C7A12] hover:underline"
            >
              {tHome(`categories.${category}.name`)}
            </Link>
          )}
          <h1 className="ac-serif mt-1 text-[28px] font-bold leading-snug text-[#173F35] sm:text-[36px]">
            {course.title}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px] text-[#5E6A62]">
            {course.profiles?.handle ? (
              <Link href={`/u/${course.profiles.handle}`} className="font-medium text-[#173F35] hover:underline">
                {authorName}
              </Link>
            ) : (
              <span>{authorName}</span>
            )}
            {verified && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#1F7A4D]/10 px-2 py-0.5 text-[11px] font-semibold text-[#1F7A4D]">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M12 2 3 6v6c0 5 3.8 9.3 9 10 5.2-.7 9-5 9-10V6l-9-4Zm-1.2 14.2-3.6-3.6 1.4-1.4 2.2 2.2 5-5 1.4 1.4-6.4 6.4Z" />
                </svg>
                {tHome("card.verified")}
              </span>
            )}
            {tools.length > 0 && (
              <span className="rounded-full bg-[#C9A227] px-2 py-0.5 text-[11px] font-semibold text-white">
                {tHome("card.byMaker")}
              </span>
            )}
          </div>

          {course.thumbnail_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={course.thumbnail_url} alt="" className="mt-6 aspect-video w-full rounded-xl object-cover" />
          )}

          {/* 購入ボックス（スマホでは本文の前に出す） */}
          <div className="mt-6 lg:hidden">{buyBox}</div>

          {/* 目次：有料部分の見出しも含めて必ず公開する */}
          {toc.length > 0 && (
            <nav className="mt-6 rounded-xl border border-[#E6DFCC] bg-white p-5">
              <p className="ac-serif text-[16px] font-bold text-[#173F35]">{t("toc")}</p>
              <ol className="mt-3 space-y-1.5">
                {toc.map((item, i) => {
                  const locked = isPaid && !hasFullAccess && i >= freeHeadingCount;
                  return (
                    <li
                      key={i}
                      className={`flex items-center gap-2 text-[13px] ${item.level === 3 ? "pl-5" : "font-medium"} ${locked ? "text-[#8A8F84]" : "text-[#1D2B25]"}`}
                    >
                      {locked ? (
                        <span className="text-[#C9A227]">
                          <AcIcon d={LOCK} size={13} />
                        </span>
                      ) : (
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#C9A227]" />
                      )}
                      {item.text}
                    </li>
                  );
                })}
              </ol>
            </nav>
          )}

          {/* 本文 */}
          <div
            className="course-content mt-8 rounded-xl bg-white p-5 sm:p-8"
            // 検証済みの要素・属性だけから生成したHTML（lib/academy/render.ts）
            dangerouslySetInnerHTML={{ __html: html }}
          />

          {/* 有料部分の手前で止める */}
          {isPaid && !hasFullAccess && (
            <div className="relative -mt-2 rounded-b-xl border border-t-2 border-dashed border-[#C9A227] bg-gradient-to-b from-white to-[#FBF8F0] px-5 pb-8 pt-10 text-center sm:px-8">
              <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#C9A227] bg-white px-3 py-0.5 text-[11px] font-bold text-[#9C7A12]">
                {t("paywall")}
              </span>
              <p className="ac-serif text-[18px] font-bold text-[#173F35]">{t("paywallTitle")}</p>
              <p className="mt-2 text-[13px] text-[#5E6A62]">
                {lockedCount > 0 ? t("paywallBody", { n: lockedCount }) : t("paywallBodyNoCount")}
              </p>
              <div className="mx-auto mt-5 max-w-xs">{buyBox}</div>
            </div>
          )}
        </article>

        {/* ------- サイドバー ------- */}
        <aside className="hidden space-y-4 lg:block">
          <div className="sticky top-20 space-y-4">
            {buyBox}
            {tools.length > 0 && (
              <div className="rounded-xl border border-[#E6DFCC] bg-white p-5">
                <p className="text-[12px] font-semibold text-[#9C7A12]">{t("toolsTitle")}</p>
                <ul className="mt-3 space-y-3">
                  {tools.map((tool) => (
                    <li key={tool.id}>
                      <Link href={`/apps/${tool.slug}`} className="flex items-center gap-3 hover:opacity-80">
                        <span className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-[#173F35]">
                          {tool.thumbnail_url && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={tool.thumbnail_url} alt="" className="h-full w-full object-cover" />
                          )}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] font-semibold text-[#173F35]">{tool.name}</span>
                          <span className="block truncate text-[11px] text-[#5E6A62]">{tool.tagline}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex gap-2 rounded-xl border border-[#E6DFCC] bg-white p-4 text-[12px] leading-relaxed text-[#5E6A62]">
              <span className="text-[#C9A227]">
                <AcIcon d={SHIELD} size={18} />
              </span>
              {t("trustNote")}
            </div>
          </div>
        </aside>
      </div>

      <AcademyFooter isLoggedIn={Boolean(user)} />
    </div>
  );
}
