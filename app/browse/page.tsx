import { getTranslations, getLocale } from "next-intl/server";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BrowseClient from "./BrowseClient";
import AISearchPanel from "@/components/AISearchPanel";
import { createClient } from "@/lib/supabase/server";
import { ALL_CATEGORIES_VALUE } from "@/lib/category-slugs";
import { applyToolTranslations } from "@/lib/apply-translations";
import type { Locale } from "@/i18n/config";
import { tools as mockTools, type Tool } from "@/lib/mock-data";

async function loadRealTools(locale: Locale): Promise<Tool[]> {
  const tCommon = await getTranslations("common");
  const supabase = await createClient();
  const { data } = await supabase
    .from("tools")
    .select("*, profiles:author_id(display_name, handle)")
    .eq("status", "published")
    .order("created_at", { ascending: false });

  const tools =
    data?.map((r) => ({
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
    })) || [];

  // デモ用のmockToolsはDBに実体が無いので、この時点（実データのみ）で翻訳を適用する
  return applyToolTranslations(supabase, tools, locale);
}

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const { q, category } = await searchParams;
  const locale = (await getLocale()) as Locale;
  const realTools = await loadRealTools(locale);
  // 実際の出品を先頭に、デモ用のツールをその後ろに並べる
  const allTools = [...realTools, ...mockTools];

  return (
    <>
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-6 pt-8">
          <AISearchPanel />
        </div>
        <BrowseClient
          initialTools={allTools}
          initialQuery={q ?? ""}
          initialCategory={category ?? ALL_CATEGORIES_VALUE}
        />
      </main>
      <Footer />
    </>
  );
}
