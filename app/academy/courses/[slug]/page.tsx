import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AcademyBlurs from "@/components/academy/AcademyBlurs";
import { AcIcon } from "@/components/academy/AcademyChrome";
import { renderCourseHtml } from "@/lib/academy/render";
import { isCourseCategory } from "@/lib/academy/categories";
import { COURSE_PURCHASE_ENABLED } from "@/lib/academy/flags";
import BuyCourseButton from "@/components/academy/BuyCourseButton";
import PurchasedCelebration from "@/components/academy/PurchasedCelebration";
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
  refund_policy: "none" | "conditional" | "full";
  profiles: { display_name: string | null; handle: string | null } | null;
};

const SELECT =
  "id, slug, title, thumbnail_url, price, status, category, toc, free_content, author_id, refund_policy, profiles:author_id(display_name, handle)";

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

export default async function CoursePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ purchased?: string }>;
}) {
  const { slug } = await params;
  const justPurchased = (await searchParams).purchased === "1";
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
  // 購入済みか（購入記録は本人のものだけ読める）
  let purchased = false;
  if (user && course.price > 0 && !isAuthor) {
    const { data: p } = await supabase
      .from("course_purchases")
      .select("id")
      .eq("course_id", course.id)
      .eq("buyer_id", user.id)
      .eq("status", "completed")
      .maybeSingle();
    purchased = Boolean(p);
  }
  const hasFullAccess =
    Boolean(fullDoc) && (course.price === 0 || isAuthor || isAdmin || purchased);

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
    <div className="rounded-xl border border-border bg-surface p-5">
      <p className={`font-display text-[26px] font-bold ${isPaid ? "text-text-primary" : "text-[#1F7A4D]"}`}>
        {isPaid ? `¥${course.price.toLocaleString()}` : tHome("card.free")}
      </p>
      {!isPaid ? (
        <p className="mt-2 text-[13px] text-text-muted">{t("freeNote")}</p>
      ) : purchased ? (
        <p className="mt-2 rounded-lg bg-accent-success/10 px-3 py-2 text-[12px] font-medium text-accent-success">
          {t("purchasedNote")}
        </p>
      ) : hasFullAccess ? (
        <p className="mt-2 rounded-lg bg-bg px-3 py-2 text-[12px] text-text-muted">
          {isAuthor ? t("authorPreview") : t("adminPreview")}
        </p>
      ) : (
        <>
          <BuyCourseButton
            courseId={course.id}
            enabled={COURSE_PURCHASE_ENABLED && verified}
            label={COURSE_PURCHASE_ENABLED ? (verified ? t("buy") : t("buyUnavailable")) : t("buyComingSoon")}
          />
          <p className="mt-2 text-[11px] text-text-dim">{t("buyNote")}</p>
        </>
      )}
      {isPaid && (
        <p className="mt-3 flex items-center justify-between rounded-lg border border-border px-3 py-2 text-[12px]">
          <span className="text-text-muted">{t("refundTitle")}</span>
          <span className="font-medium text-text-secondary">{t(`refund.${course.refund_policy ?? "none"}`)}</span>
        </p>
      )}
      <ul className="mt-4 space-y-1.5 border-t border-border pt-4 text-[12px] text-text-secondary">
        <li>{tHome("card.chapters", { n: toc.filter((x) => x.level === 2).length || toc.length })}</li>
        {isPaid && lockedCount > 0 && <li>{t("lockedCount", { n: lockedCount })}</li>}
      </ul>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col bg-bg text-text-primary">
      <Header />

      {/* 購入が確認できていれば中央のお祝い演出、まだなら「確認中」の帯を出す */}
      {justPurchased && purchased && <PurchasedCelebration />}
      {justPurchased && !purchased && (
        <div className="border-b border-accent-ai/30 bg-accent-ai-dim px-4 py-2.5 text-center text-[13px] text-accent-ai">
          {/* Stripeから戻った直後は、支払い完了の通知がまだ届いていないことがある */}
          {t("purchasePending")}{" "}
          <Link href={`/academy/courses/${course.slug}?purchased=1`} className="font-semibold underline">
            {t("reload")}
          </Link>
        </div>
      )}

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

      {/* Creativeの商品ページと同じく、白地に控えめな緑と金のぼかしで「Academyの中」だと分かるようにする */}
      <main className="relative flex-1 overflow-hidden">
      <AcademyBlurs subtle />
      <div className="relative mx-auto max-w-6xl px-4 pt-8 sm:px-6">
        <Link
          href="/academy"
          className="inline-flex items-center rounded-full border border-border bg-bg/80 px-3 py-1.5 backdrop-blur transition hover:border-border-strong"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/academy-logo.png" alt="BuildBay Academy" width={1400} height={182} className="h-4 w-auto" />
        </Link>
      </div>
      <div className="relative mx-auto grid max-w-6xl gap-8 px-4 py-6 sm:px-6 lg:grid-cols-[1fr_20rem]">
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
          <h1 className="font-display mt-1 text-[28px] font-bold leading-snug text-text-primary sm:text-[36px]">
            {course.title}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px] text-text-muted">
            {course.profiles?.handle ? (
              <Link href={`/u/${course.profiles.handle}`} className="font-medium text-text-primary hover:underline">
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
            <nav className="mt-6 rounded-xl border border-border bg-surface p-5">
              <p className="font-display text-[16px] font-bold text-text-primary">{t("toc")}</p>
              <ol className="mt-3 space-y-1.5">
                {toc.map((item, i) => {
                  const locked = isPaid && !hasFullAccess && i >= freeHeadingCount;
                  return (
                    <li
                      key={i}
                      className={`flex items-center gap-2 text-[13px] ${item.level === 3 ? "pl-5" : "font-medium"} ${locked ? "text-text-dim" : "text-text-primary"}`}
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
            className="course-content mt-8 rounded-xl bg-surface p-5 sm:p-8"
            // 検証済みの要素・属性だけから生成したHTML（lib/academy/render.ts）
            dangerouslySetInnerHTML={{ __html: html }}
          />

          {/* 有料部分の手前で止める */}
          {isPaid && !hasFullAccess && (
            <div className="relative -mt-2 rounded-b-xl border border-t-2 border-dashed border-[#C9A227] bg-surface px-5 pb-8 pt-10 text-center sm:px-8">
              <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#C9A227] bg-surface px-3 py-0.5 text-[11px] font-bold text-[#9C7A12]">
                {t("paywall")}
              </span>
              <p className="font-display text-[18px] font-bold text-text-primary">{t("paywallTitle")}</p>
              <p className="mt-2 text-[13px] text-text-muted">
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
              <div className="rounded-xl border border-border bg-surface p-5">
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
                          <span className="block truncate text-[13px] font-semibold text-text-primary">{tool.name}</span>
                          <span className="block truncate text-[11px] text-text-muted">{tool.tagline}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex gap-2 rounded-xl border border-border bg-surface p-4 text-[12px] leading-relaxed text-text-muted">
              <span className="text-[#C9A227]">
                <AcIcon d={SHIELD} size={18} />
              </span>
              {t("trustNote")}
            </div>
          </div>
        </aside>
      </div>

      </main>
      <Footer />
    </div>
  );
}
