import { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BuyBox from "@/components/BuyBox";
import LikeButton from "@/components/LikeButton";
import ReportButton from "@/components/ReportButton";
import AuthorCard from "@/components/AuthorCard";
import ToolCard from "@/components/ToolCard";
import ToolReviews from "@/components/ToolReviews";
import PurchaseSuccessModal from "@/components/PurchaseSuccessModal";
import ImageCarousel from "@/components/ImageCarousel";
import { createClient } from "@/lib/supabase/server";
import { getToolBySlug, tools as mockTools, formatInstalls, type Tool } from "@/lib/mock-data";

async function loadTool(
  slug: string
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
        name: row.profiles?.display_name || "名前未設定の開発者",
        handle: row.profiles?.handle ? `@${row.profiles.handle}` : "",
      },
      tags: row.tags || [],
      updatedAt: (row.updated_at || "").slice(0, 10),
      runtime: row.runtime,
      thumbnailUrl: row.thumbnail_url || null,
      galleryUrls: row.gallery_urls || [],
      fileSizeBytes: row.file_size_bytes ?? null,
    };

    // 閲覧数（インプレッション表示用）。失敗しても閲覧自体は成立させたいので、
    // ページ表示をブロックしない範囲でエラーは無視する。
    void supabase.rpc("increment_view_count", { p_tool_id: row.id });

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
          name: r.profiles?.display_name || "名前未設定の開発者",
          handle: r.profiles?.handle ? `@${r.profiles.handle}` : "",
        },
        tags: r.tags || [],
        updatedAt: (r.updated_at || "").slice(0, 10),
        runtime: r.runtime,
        thumbnailUrl: r.thumbnail_url || null,
      })) || [];

    // 実際の出品がまだ少ない間は、デモ用のツールで欄を埋める
    const filler = mockTools.filter((t) => t.slug !== slug).slice(0, 3 - related.length);

    return {
      tool,
      related: [...related, ...filler],
      isDemo: false,
      status: row.status,
      rejectionReason: row.rejection_reason ?? null,
      authorId: row.author_id,
    };
  }

  // データベースに無ければ、デモ用のモックデータにフォールバックする
  const mockTool = getToolBySlug(slug);
  if (!mockTool) return null;

  return {
    tool: mockTool,
    related: mockTools.filter((t) => t.id !== mockTool.id).slice(0, 3),
    isDemo: true,
    status: "published",
    rejectionReason: null,
    authorId: null,
  };
}

export default async function ToolDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const result = await loadTool(slug);

  if (!result) notFound();
  const { tool, related, isDemo, status, rejectionReason, authorId } = result;

  // ログイン状態と購入状態を取得する
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isOwner = Boolean(user) && authorId === user?.id;

  // 以下の3つは互いに依存しないので同時に問い合わせる
  // （DBが東京リージョンにあり、1回の往復にも時間がかかるため、
  //  直列にすると表示速度に直結する）。
  const [{ data: purchase }, { data: like }, { data: reviewRows }] = await Promise.all([
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
  ]);

  const isPurchased = Boolean(purchase);
  const isLiked = Boolean(like);

  const reviews = (reviewRows ?? []).map((r) => {
    const profile = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    return {
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      created_at: r.created_at,
      author_id: r.author_id,
      author_name: profile?.display_name || (profile?.handle ? `@${profile.handle}` : "匿名"),
    };
  });

  return (
    <>
      <Header />
      <Suspense fallback={null}>
        <PurchaseSuccessModal />
      </Suspense>

      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-6 py-8">
          {isOwner && status !== "published" && (
            <div className="mb-6 rounded-lg border border-accent-ai/30 bg-accent-ai-dim px-4 py-3 text-[13px] text-accent-ai">
              {status === "pending_review" &&
                "このツールは審査中です。承認されると一般公開されます（このプレビューはあなただけに見えています）。"}
              {status === "rejected" &&
                "このツールは却下されました。マイページで却下理由を確認してください（このプレビューはあなただけに見えています）。"}
              {status === "suspended" &&
                (rejectionReason
                  ? `このツールは運営により非公開にされています。理由: ${rejectionReason}（このプレビューはあなただけに見えています）`
                  : "このツールは現在非公開です（このプレビューはあなただけに見えています）。")}
              {status === "draft" &&
                "このツールは下書きです（このプレビューはあなただけに見えています）。"}
            </div>
          )}
          {/* Breadcrumb */}
          <nav className="mb-6 flex items-center gap-1.5 text-[13px] text-text-muted">
            <Link href="/" className="hover:text-text-secondary">
              BuildBay
            </Link>
            <span>/</span>
            <Link href="/browse" className="hover:text-text-secondary">
              {tool.category}
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
                          {c}
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
                  {tool.runtime === "cloud" ? "利用" : "ダウンロード"} {formatInstalls(tool.installs)}
                </span>
                <span className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-[13px] text-text-secondary">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" className="text-accent-signal">
                    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 1 0-7.8 7.8l1.1 1L12 21l7.7-7.7 1.1-1a5.5 5.5 0 0 0 0-7.8Z" />
                  </svg>
                  いいね {tool.likes}
                </span>
                <span className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-[13px] text-text-secondary">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted">
                    <path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" />
                    <circle cx="12" cy="12" r="2.5" />
                  </svg>
                  閲覧 {formatInstalls(tool.views)}
                </span>
              </div>

              {/* Preview image(s) */}
              <ImageCarousel
                images={[
                  ...(tool.thumbnailUrl ? [tool.thumbnailUrl] : []),
                  ...(tool.galleryUrls ?? []),
                ]}
                fallbackLabel={tool.name.slice(0, 2).toUpperCase()}
              />

              {/* Description */}
              <section className="mb-8">
                <h2 className="mb-3 font-display text-lg font-semibold text-text-primary">
                  概要
                </h2>
                <p className="whitespace-pre-line text-[14px] leading-relaxed text-text-secondary">
                  {tool.description}
                </p>
              </section>

              {/* Tags */}
              <section className="mb-8">
                <div className="flex flex-wrap gap-2">
                  {tool.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-border px-3 py-1 text-[12px] text-text-secondary"
                    >
                      #{tag}
                    </span>
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
            </div>

            {/* Sidebar */}
            <div className="space-y-5">
              <BuyBox
                tool={tool}
                isLoggedIn={Boolean(user)}
                isOwner={isOwner}
                isPurchased={isPurchased}
                isDemo={isDemo}
              />
              {/* デモ用ツールはDBに実体が無いのでいいねできない */}
              {!isDemo && (
                <LikeButton
                  toolId={tool.id}
                  slug={tool.slug}
                  initialLiked={isLiked}
                  initialCount={tool.likes}
                />
              )}
              <AuthorCard tool={tool} />
              {!isDemo && !isOwner && (
                <div className="text-center">
                  <ReportButton toolId={tool.id} slug={tool.slug} />
                </div>
              )}
            </div>
          </div>

          {/* Related tools */}
          <section className="mt-16 border-t border-border pt-10">
            <h2 className="mb-5 font-display text-lg font-semibold text-text-primary">
              こちらもおすすめ
            </h2>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              {related.map((t) => (
                <ToolCard key={t.id} tool={t} />
              ))}
            </div>
          </section>
        </div>
      </main>

      <Footer width="max-w-6xl" />
    </>
  );
}
