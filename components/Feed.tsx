"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import PostComposer from "@/components/PostComposer";
import PostCard from "@/components/PostCard";
import { loadMorePosts, type PostItem } from "@/app/feed/actions";

export default function Feed({
  initialPosts,
  initialHasMore,
  isLoggedIn,
}: {
  initialPosts: PostItem[];
  initialHasMore: boolean;
  isLoggedIn: boolean;
}) {
  const t = useTranslations("feed");
  const [posts, setPosts] = useState(initialPosts);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isPending, startTransition] = useTransition();

  function handlePosted(post: PostItem) {
    setPosts((prev) => [post, ...prev]);
  }

  function handleDeleted(id: string) {
    setPosts((prev) => prev.filter((p) => p.id !== id));
  }

  function handleLoadMore() {
    const last = posts[posts.length - 1];
    if (!last) return;
    startTransition(async () => {
      const result = await loadMorePosts(last.created_at);
      setPosts((prev) => [...prev, ...result.posts]);
      setHasMore(result.hasMore);
    });
  }

  return (
    <div>
      {isLoggedIn && <PostComposer onPosted={handlePosted} />}

      {posts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <p className="text-[13px] text-text-muted">{t("empty")}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} isLoggedIn={isLoggedIn} onDeleted={handleDeleted} />
          ))}
        </div>
      )}

      {hasMore && (
        <button
          type="button"
          onClick={handleLoadMore}
          disabled={isPending}
          className="mt-5 w-full rounded-lg border border-border py-2.5 text-[13px] text-text-secondary transition hover:bg-surface disabled:opacity-60"
        >
          {isPending ? t("loadingMore") : t("loadMore")}
        </button>
      )}
    </div>
  );
}
