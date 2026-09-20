import { getTranslations } from "next-intl/server";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Feed from "@/components/Feed";
import { createClient } from "@/lib/supabase/server";
import { FEED_PAGE_SIZE } from "./constants";

export async function generateMetadata() {
  const t = await getTranslations("feed");
  return { title: t("pageTitle"), description: t("pageDescription") };
}

export default async function FeedPage() {
  const t = await getTranslations("feed");
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("posts")
    .select(
      "*, profiles:author_id(display_name, handle, avatar_url)"
    )
    .order("created_at", { ascending: false })
    .limit(FEED_PAGE_SIZE + 1);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let likedIds = new Set<string>();
  const page = (rows ?? []).slice(0, FEED_PAGE_SIZE);
  if (user && page.length > 0) {
    const { data: likes } = await supabase
      .from("post_likes")
      .select("post_id")
      .eq("user_id", user.id)
      .in(
        "post_id",
        page.map((r) => r.id)
      );
    likedIds = new Set((likes ?? []).map((l) => l.post_id));
  }

  const initialPosts = page.map((r) => ({
    id: r.id,
    content: r.content,
    image_url: r.image_url,
    view_count: r.view_count,
    like_count: r.like_count,
    comment_count: r.comment_count,
    created_at: r.created_at,
    author: {
      display_name: r.profiles?.display_name ?? null,
      handle: r.profiles?.handle ?? "",
      avatar_url: r.profiles?.avatar_url ?? null,
    },
    likedByMe: likedIds.has(r.id),
    isOwn: user?.id === r.author_id,
  }));

  const hasMore = (rows?.length ?? 0) > FEED_PAGE_SIZE;

  return (
    <>
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-xl px-6 py-10">
          <h1 className="mb-1 font-display text-2xl font-semibold text-text-primary">
            {t("pageTitle")}
          </h1>
          <p className="mb-6 text-[13px] text-text-muted">{t("pageSubtitle")}</p>

          <Feed
            initialPosts={initialPosts}
            initialHasMore={hasMore}
            isLoggedIn={Boolean(user)}
          />
        </div>
      </main>
      <Footer />
    </>
  );
}
