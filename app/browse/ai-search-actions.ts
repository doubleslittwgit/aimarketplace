"use server";

import { getTranslations, getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { applyToolTranslations } from "@/lib/apply-translations";
import { searchToolsWithAI, type AiSearchMatch } from "@/lib/ai/search-tools";
import type { Locale } from "@/i18n/config";
import type { Tool } from "@/lib/mock-data";

export async function aiSearchTools(
  query: string
): Promise<{ tools: (Tool & { aiReason: string })[]; error: string | null }> {
  const t = await getTranslations("errors");
  const trimmed = query.trim();
  if (!trimmed) return { tools: [], error: t("aiSearchQueryRequired") };

  const locale = (await getLocale()) as Locale;
  const supabase = await createClient();
  const tCommon = await getTranslations("common");

  const { data } = await supabase
    .from("tools")
    .select("*, profiles:author_id(display_name, handle)")
    .eq("status", "published");

  const rows = data ?? [];
  if (rows.length === 0) return { tools: [], error: null };

  const { matches, error } = await searchToolsWithAI(
    trimmed,
    rows.map((r) => ({
      slug: r.slug,
      name: r.name,
      tagline: r.tagline,
      description: r.description,
      category: r.category,
      tags: r.tags || [],
    }))
  );

  if (error) return { tools: [], error };
  if (matches.length === 0) return { tools: [], error: null };

  const rowBySlug = new Map(rows.map((r) => [r.slug, r]));
  const reasonBySlug = new Map<string, string>(matches.map((m: AiSearchMatch) => [m.slug, m.reason]));

  const orderedTools: Tool[] = matches
    .map((m) => rowBySlug.get(m.slug))
    .filter((r): r is NonNullable<typeof r> => Boolean(r))
    .map((r) => ({
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
    }));

  const translated = await applyToolTranslations(supabase, orderedTools, locale);

  return {
    tools: translated.map((tool) => ({ ...tool, aiReason: reasonBySlug.get(tool.slug) ?? "" })),
    error: null,
  };
}
