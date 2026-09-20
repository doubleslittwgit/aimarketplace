import { getTranslations } from "next-intl/server";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Feed from "@/components/Feed";
import { createClient } from "@/lib/supabase/server";
import { fetchFeedPosts } from "./actions";

export async function generateMetadata() {
  const t = await getTranslations("feed");
  return { title: t("pageTitle"), description: t("pageDescription") };
}

export default async function FeedPage() {
  const t = await getTranslations("feed");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { posts: initialPosts, hasMore } = await fetchFeedPosts({ mode: "all" });

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
