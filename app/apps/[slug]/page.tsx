import { Suspense } from "react";
import { notFound } from "next/navigation";
import { after } from "next/server";
import Link from "next/link";
import { getTranslations, getLocale } from "next-intl/server";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BuyBox from "@/components/BuyBox";
import LikeButton from "@/components/LikeButton";
import ReportButton from "@/components/ReportButton";
import AuthorCard from "@/components/AuthorCard";
import ToolQA from "@/components/ToolQA";
import ToolNotes, { type ToolNoteItem } from "@/components/ToolNotes";
import TipBox from "@/components/TipBox";
import ToolCard from "@/components/ToolCard";
import ToolReviews from "@/components/ToolReviews";
import PurchaseSuccessModal from "@/components/PurchaseSuccessModal";
import ImageCarousel from "@/components/ImageCarousel";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseVideoUrl } from "@/lib/video-embed";
import { isCreativeTool } from "@/lib/creative-apps";
import RainbowBlurs from "@/components/creative/RainbowBlurs";
import { categoryToSlug } from "@/lib/category-slugs";
import { applyToolTranslations, applyReviewTranslations } from "@/lib/apply-translations";
import type { Locale } from "@/i18n/config";
import { formatInstalls, type Tool } from "@/lib/mock-data";

async function loadTool(
  slug: string,
  locale: Locale
): Promise<
  | {
      tool: Tool;
      related: Tool[];
      isDemo: boolean;
      status: string;
      rejectionReason: string | null;
      authorId: string | null;
    }
  | null
> {
  const tCommon = await getTranslations("common");
  const supabase = await createClient();

  const { data: row } = await supabase
    .from("tools")
    .select("*, profiles:author_id(display_name, handle)")
    .eq("slug", slug)
    .maybeSingle();

  if (row) {
    const tool: Tool = {
      id: row.id,
      slug: row.slug,
      name: row.name,
      tagline: row.tagline,
      description: row.description,
      category: row.category,
      categories: row.categories?.length ? row.categories : [row.category],
      price: row.price,
      version: row.version,
      installs: row.install_count,
      likes: row.like_count,
      views: row.view_count,
      author: {
        name: row.profiles?.display_name || tCommon("unnamedDeveloper"),
        handle: row.profiles?.handle ? `@${row.profiles.handle}` : "",
      },
      tags: row.tags || [],
      updatedAt: (row.updated_at || "").slice(0, 10),
      runtime: row.runtime,
      thumbnailUrl: row.thumbnail_url || null,
      salePrice: row.sale_price ?? null,
      saleEndsAt: row.sale_ends_at ?? null,
      remixAllowed: row.remix_allowed ?? false,
      refundPolicy: row.refund_policy ?? "none",
      isWip: row.is_wip ?? false,
      videoUrl: row.video_url ?? null,
      hostApps: (row.host_apps as string[] | null) ?? [],
      galleryUrls: row.gallery_urls || [],
      fileSizeBytes: row.file_size_bytes ?? null,
    };

    // 閲覧数（インプレッション表示用）。
    // 以前は await せず投げっぱなしにしていたが、Vercelのサーバー関数は
    // レスポンス送信後すぐに環境を止めてしまうことがあり、
    // 待たない通信は完了する前に消えてしまっていた（実際、全ツールの
    // 閲覧数が0のままになっていた）。after() はレスポンスを遅らせずに、
    // かつ実行環境を処理が終わるまで保持してくれるので、これに置き換える。
    after(async () => {
      try {
        await supabase.rpc("increment_view_count", { p_tool_id: row.id });
      } catch {
        // 閲覧数の記録に失敗しても、ユーザー体験には影響させない
      }
    });

    const { data: relatedRows } = await supabase
      .from("tools")
      .select("*, profiles:author_id(display_name, handle)")
      .eq("status", "published")
      .neq("id", row.id)
      .order("created_at", { ascending: false })
      .limit(3);

    const related: Tool[] =
      relatedRows?.map((r) => ({
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
      })) || [];

    const [translatedTool] = await applyToolTranslations(supabase, [tool], locale);
    const translatedRelated = await applyToolTranslations(supabase, related, locale);

    return {
      tool: translatedTool,
      related: translatedRelated,
      isDemo: false,
      status: row.status,
      rejectionReason: row.rejection_reason ?? null,
      authorId: row.author_id,
    };
  }

  // 架空のデモ用ツールにはフォールバックしない（DBに無ければ404）
  return null;
}

export default async function ToolDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const locale = (await getLocale()) as Locale;
  const intlLocale =
    ({ ja: "ja-JP", zh: "zh-TW", en: "en-US" } as Record<string, string>)[locale] ?? "ja-JP";
  const result = await loadTool(slug, locale);

  if (!result) notFound();
  const { tool, related, isDemo, status, rejectionReason, authorId } = result;
  const creative = !isDemo && isCreativeTool(tool);
  const t = await getTranslations("toolDetail");
  const tCommon = await getTranslations("common");
  const tCategories = await getTranslations("categories");

  // ログイン状態と購入状態を取得する
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isOwner = Boolean(user) && authorId === user?.id;

  // 出品者がチップを受け取れる状態か。
  // 受け取り設定が未完了の出品者にもチップ欄を出すと、送ろうとした時点で
  // 初めて「受け取れません」と分かることになり、送り手にも出品者にも
  // 気まずい。受け取れる出品者にだけ表示する。
  // seller_accounts はRLSで本人以外に非公開なので、管理者権限で読む
  // （ここで得るのは「受け取れるか」の真偽だけで、画面には何も渡さない）。
  // 同じ判定を「本人確認済み」バッジにも使う（出品者本人が見ても表示する）。
  let sellerVerified = false;
  if (!isDemo && authorId) {
    const { data: sellerAccount } = await createAdminClient()
      .from("seller_accounts")
      .select("transfers_enabled, payouts_enabled")
      .eq("user_id", authorId)
      .maybeSingle();
    sellerVerified = Boolean(
      sellerAccount?.transfers_enabled && sellerAccount?.payouts_enabled
    );
  }
  const sellerCanReceiveTips = sellerVerified && !isOwner;

  // このツールと紐付いた、公開中の Academy 講座（「このツールの作り方を学ぶ」）
  type LinkedCourse = { slug: string; title: string; thumbnail_url: string | null; price: number; status: string };
  let learnCourses: LinkedCourse[] = [];
  if (!isDemo) {
    const { data: courseLinks } = await supabase
      .from("course_tool_links")
      .select("courses(slug, title, thumbnail_url, price, status)")
      .eq("tool_id", tool.id);
    learnCourses = ((courseLinks ?? []) as unknown as { courses: LinkedCourse | null }[])
      .map((l) => l.courses)
      .filter((x): x is LinkedCourse => Boolean(x && x.status === "published"));
  }

  // 以下の3つは互いに依存しないので同時に問い合わせる
  // （DBが東京リージョンにあり、1回の往復にも時間がかかるため、
  //  直列にすると表示速度に直結する）。
  const [
    { data: purchase },
    { data: like },
    { data: reviewRows },
    { data: questionRows },
    { data: versionRows },
    { data: relatedRows },
    { data: noteRows },
  ] = await Promise.all([
    user && !isDemo
      ? supabase
          .from("purchases")
          .select("id")
          .eq("tool_id", tool.id)
          .eq("buyer_id", user.id)
          .eq("status", "completed")
          .maybeSingle()
      : Promise.resolve({ data: null }),
    // いいね済みか（RLSにより自分の行しか読めない）
    user && !isDemo
      ? supabase
          .from("tool_likes")
          .select("tool_id")
          .eq("tool_id", tool.id)
          .eq("user_id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    // レビュー一覧（デモ用のツールには実データが無いのでスキップ）
    !isDemo
      ? supabase
          .from("reviews")
          .select("id, rating, comment, created_at, author_id, profiles:author_id(display_name, handle)")
          .eq("tool_id", tool.id)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: null }),
    // Q&A一覧（同じくデモ用ツールはスキップ）
    !isDemo
      ? supabase
          .from("tool_questions")
          .select("*, profiles:asker_id(display_name, handle, avatar_url)")
          .eq("tool_id", tool.id)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: null }),
    // 更新履歴（公開中のツールは誰でも見られる。購入判断の材料になるため）
    !isDemo
      ? supabase
          .from("tool_versions")
          .select("id, version, changelog, created_at")
          .eq("tool_id", tool.id)
          .order("created_at", { ascending: false })
          .limit(20)
      : Promise.resolve({ data: null }),
    // 「このツールを買った人はこれも」。購買履歴は他人のものを直接読めないため、
    // 集計結果だけを返す専用の関数を経由する（誰が買ったかは一切返らない）。
    !isDemo
      ? supabase.rpc("get_related_tools", { p_tool_id: tool.id, p_limit: 4 })
      : Promise.resolve({ data: null }),
    // 使い方のコツ（レビューとは別枠の、実用ノウハウ）
    !isDemo
      ? supabase
          .from("tool_notes")
          .select("id, content, created_at, author_id, profiles:author_id(display_name, handle, avatar_url)")
          .eq("tool_id", tool.id)
          .order("created_at", { ascending: false })
          .limit(50)
      : Promise.resolve({ data: null }),
  ]);

  // 関連ツールの本体を取得する（RPCはIDと件数しか返さないため）
  const relatedIds = (relatedRows ?? []).map(
    (r: { tool_id: string }) => r.tool_id
  );
  let relatedTools: Tool[] = [];
  if (relatedIds.length > 0) {
    const { data: relatedToolRows } = await supabase
      .from("tools")
      .select("*, profiles:author_id(display_name, handle)")
      .in("id", relatedIds)
      .eq("status", "published");

    const mapped = (relatedToolRows ?? []).map((r) => ({
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
    }));
    relatedTools = await applyToolTranslations(supabase, mapped, locale);
  }

  const isPurchased = Boolean(purchase);
  const isLiked = Boolean(like);

  const rawReviews = (reviewRows ?? []).map((r) => {
    const profile = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    return {
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      created_at: r.created_at,
      author_id: r.author_id,
      author_name: profile?.display_name || (profile?.handle ? `@${profile.handle}` : t("reviews.anonymous")),
    };
  });

  const reviews = await applyReviewTranslations(supabase, rawReviews, locale);

  const questions = (questionRows ?? []).map((q) => ({
    id: q.id,
    question: q.question,
    answer: q.answer,
    answered_at: q.answered_at,
    created_at: q.created_at,
    asker: {
      display_name: q.profiles?.display_name ?? null,
      handle: q.profiles?.handle ?? "",
      avatar_url: q.profiles?.avatar_url ?? null,
    },
  }));

  // 購入・ダウンロード欄と、いいね・開発者。スマホとPCで置き場所が違うため、1か所で定義して両方で使う
  const purchaseBlock = (
    <>
      <BuyBox
        tool={tool}
        isLoggedIn={Boolean(user)}
        isOwner={isOwner}
        isPurchased={isPurchased}
        isDemo={isDemo}
      />
      {/* チップ（投げ銭）。無料ツールの作り手にも報いられるようにするもの */}
      {!isDemo && sellerCanReceiveTips && (
        <TipBox
          toolId={tool.id}
          slug={tool.slug}
          isLoggedIn={Boolean(user)}
          isOwner={isOwner}
        />
      )}
      {/* デモ用ツールはDBに実体が無いのでいいねできない */}
      {!isDemo && (
        <LikeButton
          toolId={tool.id}
          slug={tool.slug}
          initialLiked={isLiked}
          initialCount={tool.likes}
        />
      )}
      <AuthorCard tool={tool} isDemo={isDemo} verified={sellerVerified} />
    </>
  );

  return (
    <>
      <Header />
      <Suspense fallback={null}>
        <PurchaseSuccessModal />
      </Suspense>

      {/* Creative対象のツール（プラグイン、またはクリエイティブ系のカテゴリ）は、
          Creativeページと同じ「白地に虹色のぼかし」で表示し、Creativeの一員だと分かるようにする */}
      <main className={`flex-1 ${creative ? "relative overflow-hidden bg-bg" : ""}`}>
        {creative && <RainbowBlurs subtle />}
        <div className="relative mx-auto max-w-6xl px-6 py-8">
          {creative && (
            <Link
              href="/creative"
              className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-bg/80 px-3 py-1.5 backdrop-blur transition hover:border-border-strong"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/creative-logo.png" alt="BuildBay Creative" width={1400} height={206} className="h-4 w-auto" />
            </Link>
          )}
          {isOwner && status !== "published" && (
            <div className="mb-6 rounded-lg border border-accent-ai/30 bg-accent-ai-dim px-4 py-3 text-[13px] text-accent-ai">
              {status === "pending_review" && t("status.pendingReview")}
              {status === "rejected" && t("status.rejected")}
              {status === "suspended" &&
                (rejectionReason
                  ? t("status.suspendedWithReason", { reason: rejectionReason })
                  : t("status.suspended"))}
              {status === "draft" && t("status.draft")}
            </div>
          )}
          {/* Breadcrumb */}
          <nav className="mb-6 flex items-center gap-1.5 text-[13px] text-text-muted">
            <Link href="/" className="hover:text-text-secondary">
              BuildBay
            </Link>
            <span>/</span>
            <Link href="/browse" className="hover:text-text-secondary">
              {tCategories(categoryToSlug(tool.category))}
            </Link>
          </nav>

          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_320px]">
            {/* Main column */}
            <div>
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <h1 className="font-display text-[2rem] font-semibold leading-tight text-text-primary">
                    {tool.name}
                  </h1>
                  <p className="mt-2 text-[15px] text-text-secondary">
                    {tool.tagline}
                  </p>
                  {tool.categories.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {tool.categories.map((c) => (
                        <Link
                          key={c}
                          href={`/browse?category=${encodeURIComponent(c)}`}
                          className="rounded-full bg-surface px-2.5 py-1 text-[12px] text-text-muted transition hover:bg-surface-raised hover:text-text-secondary"
                        >
                          {tCategories(categoryToSlug(c))}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 font-mono text-[11px] tracking-wide ${
                    tool.runtime === "local"
                      ? "bg-accent-ai-dim text-accent-ai"
                      : "border border-border text-text-muted"
                  }`}
                >
                  {tool.runtime === "local" ? "LOCAL" : "CLOUD"}
                </span>
              </div>

              {/* 実績バー：ダウンロード数・いいね数・閲覧数 */}
              <div className="mb-6 flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-[13px] text-text-secondary">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent-ai">
                    <path d="M12 3v12" />
                    <path d="m7 10 5 5 5-5" />
                    <path d="M5 21h14" />
                  </svg>
                  {tool.runtime === "cloud" ? t("stats.use") : t("stats.download")} {formatInstalls(tool.installs)}
                </span>
                <span className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-[13px] text-text-secondary">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" className="text-accent-signal">
                    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 1 0-7.8 7.8l1.1 1L12 21l7.7-7.7 1.1-1a5.5 5.5 0 0 0 0-7.8Z" />
                  </svg>
                  {t("stats.likes", { count: tool.likes })}
                </span>
                <span className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-[13px] text-text-secondary">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted">
                    <path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" />
                    <circle cx="12" cy="12" r="2.5" />
                  </svg>
                  {t("stats.views", { count: formatInstalls(tool.views) })}
                </span>
              </div>

              {/* Preview image(s) */}
              <ImageCarousel
                video={parseVideoUrl(tool.videoUrl)}
                images={[
                  ...(tool.thumbnailUrl ? [tool.thumbnailUrl] : []),
                  ...(tool.galleryUrls ?? []),
                ]}
                fallbackLabel={tool.name.slice(0, 2).toUpperCase()}
              />

              {/* Description */}
              <section className="mb-8">
                <h2 className="mb-3 font-display text-lg font-semibold text-text-primary">
                  {t("description")}
                </h2>
                <p className="whitespace-pre-line text-[14px] leading-relaxed text-text-secondary">
                  {tool.description}
                </p>
              </section>

              {/* スマホでは購入欄を作品説明のすぐ下に出す（右の列はスマホだとページの最後になり、
                  ダウンロードボタンまでかなりスクロールしないと届かなかったため） */}
              <div className="mb-8 space-y-5 lg:hidden">{purchaseBlock}</div>

              {/* Tags */}
              <section className="mb-8">
                <div className="flex flex-wrap gap-2">
                  {/* タグは、同じタグを持つツールの検索結果へ繋ぐ。
                      タグはこれまで表示されるだけで、辿る導線が無かった */}
                  {tool.tags.map((tag) => (
                    <Link
                      key={tag}
                      href={`/browse?q=${encodeURIComponent(tag)}`}
                      className="rounded-full border border-border px-3 py-1 text-[12px] text-text-secondary transition hover:border-border-strong hover:bg-surface hover:text-text-primary"
                    >
                      #{tag}
                    </Link>
                  ))}
                </div>
              </section>

              {!isDemo && (
                <ToolReviews
                  toolId={tool.id}
                  slug={tool.slug}
                  reviews={reviews}
                  currentUserId={user?.id ?? null}
                  isPurchased={isPurchased}
                />
              )}

              {/* 更新履歴。「最終更新日だけ見えて中身が分からない」状態を避け、
                  買う前に「今も手入れされているツールか」が分かるようにする */}
              {!isDemo && (versionRows ?? []).length > 0 && (
                <div className="mt-8">
                  <h2 className="mb-4 font-display text-lg font-semibold text-text-primary">
                    {t("versionHistory")}
                  </h2>
                  <div className="space-y-3">
                    {(versionRows ?? []).map((v) => (
                      <div key={v.id} className="rounded-xl border border-border bg-surface p-4">
                        <div className="flex items-baseline gap-2.5">
                          <span className="rounded-md bg-accent-ai-dim px-2 py-0.5 font-mono text-[12px] font-medium text-accent-ai">
                            v{v.version}
                          </span>
                          <span className="font-mono text-[11px] text-text-dim">
                            {new Date(v.created_at).toLocaleDateString(intlLocale)}
                          </span>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-text-secondary">
                          {v.changelog}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* このツールを買った人はこれも */}
              {relatedTools.length > 0 && (
                <div className="mt-8">
                  <h2 className="mb-4 font-display text-lg font-semibold text-text-primary">
                    {t("relatedTools")}
                  </h2>
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    {relatedTools.map((rt) => (
                      <ToolCard key={rt.id} tool={rt} />
                    ))}
                  </div>
                </div>
              )}

              {!isDemo && (
                <div className="mt-8">
                  <ToolNotes
                    toolId={tool.id}
                    slug={tool.slug}
                    initialItems={(noteRows ?? []) as unknown as ToolNoteItem[]}
                    isLoggedIn={Boolean(user)}
                    currentUserId={user?.id ?? null}
                  />
                </div>
              )}

              {!isDemo && (
                <div className="mt-8">
                  <ToolQA
                    toolId={tool.id}
                    slug={tool.slug}
                    initialItems={questions}
                    isLoggedIn={Boolean(user)}
                    isOwner={isOwner}
                  />
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-5">
              {/* 購入欄。PCでは右の列の一番上、スマホでは作品説明のすぐ下に出す */}
              <div className="hidden space-y-5 lg:block">{purchaseBlock}</div>
              {learnCourses.length > 0 && (
                <div className="rounded-xl border border-[#C9A227]/40 bg-[#F7F3E8] p-5">
                  <p className="text-[12px] font-semibold text-[#9C7A12]">{t("learnCourses")}</p>
                  <ul className="mt-3 space-y-3">
                    {learnCourses.map((lc) => (
                      <li key={lc.slug}>
                        <Link href={`/academy/courses/${lc.slug}`} className="flex items-center gap-3 hover:opacity-80">
                          <span className="h-10 w-16 shrink-0 overflow-hidden rounded-md bg-[#173F35]">
                            {lc.thumbnail_url && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={lc.thumbnail_url} alt="" className="h-full w-full object-cover" />
                            )}
                          </span>
                          <span className="min-w-0">
                            <span className="line-clamp-2 text-[13px] font-semibold leading-snug text-[#173F35]">{lc.title}</span>
                            <span className="text-[11px] text-[#9C7A12]">
                              {lc.price > 0 ? `¥${lc.price.toLocaleString()}` : "BuildBay Academy"}
                            </span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {!isDemo && !isOwner && (
                <div className="text-center">
                  <ReportButton toolId={tool.id} slug={tool.slug} />
                </div>
              )}
            </div>
          </div>

          {/* Related tools（他に公開中のツールが無ければ欄ごと出さない） */}
          {related.length > 0 && (
            <section className="mt-16 border-t border-border pt-10">
              <h2 className="mb-5 font-display text-lg font-semibold text-text-primary">
                {t("relatedTools")}
              </h2>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                {related.map((t) => (
                  <ToolCard key={t.id} tool={t} />
                ))}
              </div>
            </section>
          )}
        </div>
      </main>

      <Footer width="max-w-6xl" />
    </>
  );
}
