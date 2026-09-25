import { notFound } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ToolCard from "@/components/ToolCard";
import CourseCard from "@/components/academy/CourseCard";
import { loadCourses } from "@/lib/academy/load-courses";
import ProfileHeader from "@/components/ProfileHeader";
import { createClient } from "@/lib/supabase/server";
import { applyToolTranslations } from "@/lib/apply-translations";
import type { Locale } from "@/i18n/config";
import type { Tool } from "@/lib/mock-data";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const t = await getTranslations("profile");
  const tCommon = await getTranslations("common");
  const locale = (await getLocale()) as Locale;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, handle, display_name, bio, avatar_url, created_at")
    .eq("handle", handle)
    .maybeSingle();

  if (!profile) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isOwner = user?.id === profile.id;

  const [
    { count: followerCount },
    { count: followingCount },
    followingRow,
    { data: rows },
    { data: badgeStatsRows },
    courses,
  ] = await Promise.all([
      supabase
        .from("follows")
        .select("follower_id", { count: "exact", head: true })
        .eq("following_id", profile.id),
      supabase
        .from("follows")
        .select("following_id", { count: "exact", head: true })
        .eq("follower_id", profile.id),
      user && !isOwner
        ? supabase
            .from("follows")
            .select("follower_id")
            .eq("follower_id", user.id)
            .eq("following_id", profile.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("tools")
        .select("*, profiles:author_id(display_name, handle)")
        .eq("author_id", profile.id)
        .eq("status", "published")
        .order("created_at", { ascending: false }),
      supabase.rpc("get_seller_badge_stats", { p_user_id: profile.id }),
      // BuildBay Academy で公開している講座
      loadCourses({ authorId: profile.id, limit: 20 }),
    ]);
  const isFollowing = Boolean(followingRow?.data);
  const badgeStats = badgeStatsRows?.[0] ?? {
    completed_sales_count: 0,
    qa_answered_count: 0,
    qa_avg_response_hours: null,
  };

  const rawTools: Tool[] = (rows ?? []).map((r) => ({
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
  }));

  const tools = await applyToolTranslations(supabase, rawTools, locale);

  const stats = {
    apps: tools.length,
    views: tools.reduce((sum, t) => sum + t.views, 0),
    likes: tools.reduce((sum, t) => sum + t.likes, 0),
    downloads: tools.reduce((sum, t) => sum + t.installs, 0),
  };

  const badges = {
    firstListing: stats.apps > 0,
    tenSales: badgeStats.completed_sales_count >= 10,
    fastResponder:
      badgeStats.qa_answered_count >= 3 &&
      badgeStats.qa_avg_response_hours !== null &&
      badgeStats.qa_avg_response_hours <= 24,
  };

  return (
    <>
      <Header />
      <main className="flex-1">
        <ProfileHeader
          profile={profile}
          isOwner={isOwner}
          stats={stats}
          badges={badges}
          isLoggedIn={Boolean(user)}
          initialIsFollowing={isFollowing}
          followerCount={followerCount ?? 0}
          followingCount={followingCount ?? 0}
        />

        <section className="mx-auto max-w-7xl px-6 pb-16">
          <h2 className="mb-5 font-display text-lg font-semibold text-text-primary">
            {t("publishedTools")}
          </h2>
          {tools.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
              <p className="text-[14px] text-text-muted">{t("noTools")}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {tools.map((tool) => (
                <ToolCard key={tool.id} tool={tool} />
              ))}
            </div>
          )}
        </section>

        {/* BuildBay Academy で公開している講座（1件も無ければ欄ごと出さない） */}
        {courses.length > 0 && (
          <section className="mx-auto max-w-7xl px-6 pb-16">
            <div className="mb-5 flex items-center gap-2.5">
              <h2 className="font-display text-lg font-semibold text-text-primary">{t("publishedCourses")}</h2>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/academy-logo.png" alt="BuildBay Academy" width={1400} height={182} className="h-3.5 w-auto opacity-80" />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
              {courses.map((c) => (
                <CourseCard key={c.id} course={c} />
              ))}
            </div>
          </section>
        )}
      </main>
      <Footer />
    </>
  );
}
