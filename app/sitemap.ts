import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";

const SITE_URL = "https://www.getbuildbay.com";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/browse`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/legal/terms`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/legal/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/legal/tokushoho`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/legal/contact`, changeFrequency: "yearly", priority: 0.3 },
  ];

  // 公開中のツールを列挙する。DBに到達できない場合でも
  // サイトマップ全体が失敗しないようにする。
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("tools")
      .select("slug, updated_at")
      .eq("status", "published")
      .order("updated_at", { ascending: false })
      .limit(5000);

    const toolRoutes: MetadataRoute.Sitemap = (data ?? []).map((t) => ({
      url: `${SITE_URL}/apps/${t.slug}`,
      lastModified: t.updated_at ? new Date(t.updated_at) : undefined,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));

    return [...staticRoutes, ...toolRoutes];
  } catch {
    return staticRoutes;
  }
}
