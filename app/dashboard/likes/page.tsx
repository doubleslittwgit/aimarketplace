import Link from "next/link";
import { redirect } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ToolCard from "@/components/ToolCard";
import { createClient } from "@/lib/supabase/server";
import type { Tool } from "@/lib/mock-data";

export const metadata = {
  title: "お気に入り",
};

type LikedRow = {
  created_at: string;
  tools: {
    id: string;
    slug: string;
    name: string;
    tagline: string;
    category: string;
    categories: string[] | null;
    price: number;
    runtime: "cloud" | "local";
    thumbnail_url: string | null;
    install_count: number;
    like_count: number;
    view_count: number;
    updated_at: string;
    status: string;
    author_id: string;
    profiles: { display_name: string | null; handle: string } | null;
  } | null;
};

export default async function LikesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/dashboard/likes");
  }

  // RLSにより自分がいいねした行しか返ってこない
  const { data } = await supabase
    .from("tool_likes")
    .select(
      "created_at, tools:tool_id(id, slug, name, tagline, category, price, runtime, thumbnail_url, install_count, like_count, view_count, categories, updated_at, status, author_id, profiles:author_id(display_name, handle))"
    )
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as unknown as LikedRow[];

  // 出品者が後から非公開・削除したものは一覧に出さない
  // （購入していない限り、非公開ツールを見る権利は無いため）
  const tools: Tool[] = rows
    .filter((r) => r.tools && r.tools.status === "published")
    .map((r) => {
      const t = r.tools!;
      return {
        id: t.id,
        slug: t.slug,
        name: t.name,
        tagline: t.tagline,
        description: "",
        category: t.category,
        categories: t.categories?.length ? t.categories : [t.category],
        price: t.price,
        version: "",
        installs: t.install_count,
        likes: t.like_count,
        views: t.view_count,
        author: {
          name: t.profiles?.display_name || t.profiles?.handle || "不明",
          handle: t.profiles?.handle || "",
        },
        tags: [],
        updatedAt: t.updated_at,
        runtime: t.runtime,
        thumbnailUrl: t.thumbnail_url,
      };
    });

  return (
    <>
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="font-display text-2xl font-semibold text-text-primary">
                お気に入り
              </h1>
              <p className="mt-1 text-[13px] text-text-muted">
                いいねしたツールが並びます
              </p>
            </div>
            <Link
              href="/dashboard"
              className="text-[13px] text-text-muted hover:text-text-primary"
            >
              マイページへ戻る
            </Link>
          </div>

          {tools.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
              <p className="mb-1 text-[14px] font-medium text-text-secondary">
                まだお気に入りはありません
              </p>
              <p className="mb-4 text-[13px] text-text-muted">
                気になるツールの「いいね」を押すと、ここに表示されます
              </p>
              <Link
                href="/browse"
                className="rounded-lg bg-accent-signal px-4 py-2 text-[13px] font-medium text-white transition hover:brightness-105"
              >
                ツールを探す
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {tools.map((tool) => (
                <ToolCard key={tool.id} tool={tool} />
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer width="max-w-6xl" />
    </>
  );
}
