"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import PostComposer from "@/components/PostComposer";
import PostCard from "@/components/PostCard";
import { fetchFeedPosts, type PostItem } from "@/app/feed/actions";

type Mode = "all" | "following";

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
  const [mode, setMode] = useState<Mode>("all");
  const [posts, setPosts] = useState(initialPosts);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isPending, startTransition] = useTransition();
  const [hasLoadedFollowing, setHasLoadedFollowing] = useState(false);

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
      const result = await fetchFeedPosts({ mode, before: last.created_at });
      setPosts((prev) => [...prev, ...result.posts]);
      setHasMore(result.hasMore);
    });
  }

  function switchMode(next: Mode) {
    if (next === mode) return;
    setMode(next);
    if (next === "all") {
      // 「すべて」は最初の表示内容をそのまま使い回せる
      setPosts(initialPosts);
      setHasMore(initialHasMore);
      return;
    }
    startTransition(async () => {
      const result = await fetchFeedPosts({ mode: "following" });
      setPosts(result.posts);
      setHasMore(result.hasMore);
      setHasLoadedFollowing(true);
    });
  }

  const emptyMessage =
    mode === "following"
      ? isLoggedIn
        ? t("emptyFollowing")
        : t("loginToSeeFollowing")
      : t("empty");

  return (
    <div>
      {isLoggedIn && <PostComposer onPosted={handlePosted} />}

      <div className="mb-5 flex gap-1 border-b border-border">
        <TabButton active={mode === "all"} onClick={() => switchMode("all")} label={t("tabAll")} />
        <TabButton
          active={mode === "following"}
          onClick={() => switchMode("following")}
          label={t("tabFollowing")}
        />
      </div>

      {(mode === "all" || hasLoadedFollowing || !isPending) && posts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <p className="text-[13px] text-text-muted">{emptyMessage}</p>
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

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px border-b-2 px-4 py-2.5 text-[13px] font-medium transition ${
        active
          ? "border-accent-signal text-accent-signal"
          : "border-transparent text-text-muted hover:text-text-primary"
      }`}
    >
      {label}
    </button>
  );
}
