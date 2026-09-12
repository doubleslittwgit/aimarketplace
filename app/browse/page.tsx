import Header from "@/components/Header";
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

export default async function BrowsePage() {
  const realTools = await loadRealTools();
  // 実際の出品を先頭に、デモ用のツールをその後ろに並べる
  const allTools = [...realTools, ...mockTools];

  return (
    <>
      <Header />
      <main className="flex-1">
        <BrowseClient initialTools={allTools} />
      </main>
      <footer className="border-t border-border">
        <div className="mx-auto max-w-7xl px-6 py-10 text-[13px] text-text-dim">
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
