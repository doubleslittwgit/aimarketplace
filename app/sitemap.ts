import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";

const SITE_URL = "https://www.getbuildbay.com";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/browse`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/feed`, changeFrequency: "hourly", priority: 0.7 },
    { url: `${SITE_URL}/requests`, changeFrequency: "daily", priority: 0.7 },
    { url: `${SITE_URL}/legal/terms`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/legal/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/legal/tokushoho`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/legal/contact`, changeFrequency: "yearly", priority: 0.3 },
  ];

  // ツール・投稿・プロフィールを列挙する。DBに到達できない場合でも
  // サイトマップ全体が失敗しないようにする。
  try {
    const supabase = await createClient();

    const [{ data: tools }, { data: posts }, { data: profiles }] = await Promise.all([
      supabase
        .from("tools")
        .select("slug, updated_at")
        .eq("status", "published")
        .order("updated_at", { ascending: false })
        .limit(5000),
      supabase
        .from("posts")
        .select("id, created_at")
        .order("created_at", { ascending: false })
        .limit(2000),
      // プロフィールは、何かしら公開活動（出品 or 投稿）がある人だけに絞る。
      // 作っただけで何もしていないアカウントを大量に載せても、検索エンジンの
      // クロール予算を無駄に消費するだけなので。
      supabase
        .from("profiles")
        .select("handle, id")
        .not("handle", "is", null)
        .limit(5000),
    ]);

    const toolRoutes: MetadataRoute.Sitemap = (tools ?? []).map((t) => ({
      url: `${SITE_URL}/apps/${t.slug}`,
      lastModified: t.updated_at ? new Date(t.updated_at) : undefined,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));

    const postRoutes: MetadataRoute.Sitemap = (posts ?? []).map((p) => ({
      url: `${SITE_URL}/feed/${p.id}`,
      lastModified: p.created_at ? new Date(p.created_at) : undefined,
      changeFrequency: "monthly" as const,
      priority: 0.4,
    }));

    let activeProfileIds = new Set<string>();
    if (profiles && profiles.length > 0) {
      const [{ data: toolAuthors }, { data: postAuthors }] = await Promise.all([
        supabase.from("tools").select("author_id").eq("status", "published"),
        supabase.from("posts").select("author_id"),
      ]);
      activeProfileIds = new Set([
        ...(toolAuthors ?? []).map((r) => r.author_id),
        ...(postAuthors ?? []).map((r) => r.author_id),
      ]);
    }

    const profileRoutes: MetadataRoute.Sitemap = (profiles ?? [])
      .filter((p) => activeProfileIds.has(p.id))
      .map((p) => ({
        url: `${SITE_URL}/u/${p.handle}`,
        changeFrequency: "weekly" as const,
        priority: 0.5,
      }));

    return [...staticRoutes, ...toolRoutes, ...postRoutes, ...profileRoutes];
  } catch {
    return staticRoutes;
  }
}
