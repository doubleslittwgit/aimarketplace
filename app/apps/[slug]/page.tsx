import { notFound } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";
import BuyBox from "@/components/BuyBox";
import AuthorCard from "@/components/AuthorCard";
import ToolCard from "@/components/ToolCard";
import { createClient } from "@/lib/supabase/server";
import { getToolBySlug, tools as mockTools, formatInstalls, type Tool } from "@/lib/mock-data";

async function loadTool(
  slug: string
): Promise<{ tool: Tool; related: Tool[]; isDemo: boolean } | null> {
  const supabase = await createClient();

  const { data: row } = await supabase
    .from("tools")
    .select("*, profiles:author_id(display_name, handle)")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (row) {
    const tool: Tool = {
      id: row.id,
      slug: row.slug,
      name: row.name,
      tagline: row.tagline,
      description: row.description,
      category: row.category,
      price: row.price,
      version: row.version,
      installs: row.install_count,
      likes: row.like_count,
      author: {
        name: row.profiles?.display_name || "名前未設定の開発者",
        handle: row.profiles?.handle ? `@${row.profiles.handle}` : "",
      },
      tags: row.tags || [],
      updatedAt: (row.updated_at || "").slice(0, 10),
      runtime: row.runtime,
      thumbnailUrl: row.thumbnail_url || null,
    };

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
        price: r.price,
        version: r.version,
        installs: r.install_count,
        likes: r.like_count,
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

    return { tool, related: [...related, ...filler], isDemo: false };
  }

  // データベースに無ければ、デモ用のモックデータにフォールバックする
  const mockTool = getToolBySlug(slug);
  if (!mockTool) return null;

  return {
    tool: mockTool,
    related: mockTools.filter((t) => t.id !== mockTool.id).slice(0, 3),
    isDemo: true,
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
  const { tool, related, isDemo } = result;

  // ログイン状態と購入状態を取得する
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isPurchased = false;
  let isOwner = false;

  if (user && !isDemo) {
    const { data: purchase } = await supabase
      .from("purchases")
      .select("id")
      .eq("tool_id", tool.id)
      .eq("buyer_id", user.id)
      .eq("status", "completed")
      .maybeSingle();
    isPurchased = Boolean(purchase);

    const { data: ownerCheck } = await supabase
      .from("tools")
      .select("author_id")
      .eq("id", tool.id)
      .maybeSingle();
    isOwner = ownerCheck?.author_id === user.id;
  }

  return (
    <>
      <Header />

      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-6 py-8">
          {/* Breadcrumb */}
          <nav className="mb-6 flex items-center gap-1.5 text-[13px] text-text-muted">
            <Link href="/" className="hover:text-text-secondary">
              forge
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

              {/* Manifest strip */}
              <div className="mb-6 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-border bg-surface px-4 py-3 font-mono text-[12px] text-text-muted">
                <span>
                  pkg://{tool.slug}
                  <span className="text-text-secondary">@v{tool.version}</span>
                </span>
                <span className="flex items-center gap-1">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2 2 7l10 5 10-5-10-5Z" opacity=".5" />
                    <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
                  </svg>
                  {formatInstalls(tool.installs)} installs
                </span>
                <span>♥ {tool.likes}</span>
              </div>

              {/* Preview image */}
              <div className="mb-8 flex h-72 items-center justify-center overflow-hidden rounded-xl border border-border bg-gradient-to-br from-surface-raised to-surface">
                {tool.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={tool.thumbnailUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="font-display text-5xl font-semibold text-text-dim/40">
                    {tool.name.slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>

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
              <AuthorCard tool={tool} />
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

      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-10 text-[13px] text-text-dim">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <span className="font-display text-text-muted">forge.</span>
            <div className="flex gap-6">
              <a href="#" className="hover:text-text-secondary">利用規約</a>
              <a href="#" className="hover:text-text-secondary">プライバシーポリシー</a>
              <a href="#" className="hover:text-text-secondary">お問い合わせ</a>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
