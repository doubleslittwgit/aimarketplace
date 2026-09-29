import { getTranslations, getLocale } from "next-intl/server";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BrowseClient from "./BrowseClient";
import AISearchPanel from "@/components/AISearchPanel";
import { createClient } from "@/lib/supabase/server";
import { ALL_CATEGORIES_VALUE } from "@/lib/category-slugs";
import { applyToolTranslations } from "@/lib/apply-translations";
import type { Locale } from "@/i18n/config";
import type { Tool } from "@/lib/mock-data";
import { shareMetadata } from "@/lib/seo";

export async function generateMetadata() {
  const t = await getTranslations("browse");
  return shareMetadata({ title: t("title"), description: t("metaDescription"), path: "/browse" });
}

async function loadRealTools(locale: Locale): Promise<Tool[]> {
  const tCommon = await getTranslations("common");
  const supabase = await createClient();
  const { data } = await supabase
    .from("tools")
    .select("*, profiles:author_id(display_name, handle)")
    .eq("status", "published")
    .order("created_at", { ascending: false });

  // 評価（★）で絞り込み・並べ替えできるよう、レビューの平均と件数をツールごとにまとめる
  const ids = (data ?? []).map((r) => r.id);
  const { data: reviewRows } = ids.length
    ? await supabase.from("reviews").select("tool_id, rating").in("tool_id", ids)
    : { data: [] as { tool_id: string; rating: number }[] };
  const ratings = new Map<string, { avg: number; count: number }>();
  for (const row of reviewRows ?? []) {
    const cur = ratings.get(row.tool_id) ?? { avg: 0, count: 0 };
    const count = cur.count + 1;
    ratings.set(row.tool_id, { count, avg: (cur.avg * cur.count + Number(row.rating)) / count });
  }

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
      salePrice: r.sale_price ?? null,
      saleEndsAt: r.sale_ends_at ?? null,
      isWip: r.is_wip ?? false,
      internetAccess: r.internet_access ?? null,
      uiLanguages: r.ui_languages ?? [],
      platforms: r.platforms ?? [],
      remixAllowed: r.remix_allowed ?? false,
      refundPolicy: r.refund_policy ?? "none",
      ratingAvg: ratings.get(r.id)?.avg ?? 0,
      ratingCount: ratings.get(r.id)?.count ?? 0,
    })) || [];

  return applyToolTranslations(supabase, tools, locale);
}

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  // 絞り込みの条件（?price=free&runtime=local など）を、そのまま画面に渡す
  const params: Record<string, string | undefined> = Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])
  );
  const { q, category } = params;
  const locale = (await getLocale()) as Locale;
  const realTools = await loadRealTools(locale);
  // 実際に公開されているツールだけを並べる（架空のデモ用ツールは混ぜない）
  const allTools = realTools;

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
          initialParams={params}
        />
      </main>
      <Footer />
    </>
  );
}
