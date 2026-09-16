import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BrowseClient from "./BrowseClient";
import { createClient } from "@/lib/supabase/server";
import { tools as mockTools, type Tool } from "@/lib/mock-data";

async function loadRealTools(): Promise<Tool[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tools")
    .select("*, profiles:author_id(display_name, handle)")
    .eq("status", "published")
    .order("created_at", { ascending: false });

  return (
    data?.map((r) => ({
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
      views: r.view_count,
      author: {
        name: r.profiles?.display_name || "名前未設定の開発者",
        handle: r.profiles?.handle ? `@${r.profiles.handle}` : "",
      },
      tags: r.tags || [],
      updatedAt: (r.updated_at || "").slice(0, 10),
      runtime: r.runtime,
      thumbnailUrl: r.thumbnail_url || null,
    })) || []
  );
}

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const realTools = await loadRealTools();
  // 実際の出品を先頭に、デモ用のツールをその後ろに並べる
  const allTools = [...realTools, ...mockTools];

  return (
    <>
      <Header />
      <main className="flex-1">
        <BrowseClient initialTools={allTools} initialQuery={q ?? ""} />
      </main>
      <Footer />
    </>
  );
}
