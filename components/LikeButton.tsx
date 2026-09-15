"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toggleLike } from "@/app/apps/[slug]/like-actions";

type Props = {
  toolId: string;
  slug: string;
  initialLiked: boolean;
  initialCount: number;
};

export default function LikeButton({
  toolId,
  slug,
  initialLiked,
  initialCount,
}: Props) {
  const router = useRouter();
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    setError(null);

    // 押した瞬間に見た目を切り替える（通信を待たせない）。
    // 失敗したらこの値を元に戻す。
    const prevLiked = liked;
    const prevCount = count;
    setLiked(!prevLiked);
    setCount(prevCount + (prevLiked ? -1 : 1));

    startTransition(async () => {
      const result = await toggleLike(toolId);

      if (!result.ok) {
        setLiked(prevLiked);
        setCount(prevCount);
        if (result.needsLogin) {
          router.push(`/login?next=${encodeURIComponent(`/apps/${slug}`)}`);
          return;
        }
        setError(result.error);
        return;
      }

      // サーバーが返した実際の値に合わせる
      setLiked(result.liked);
      setCount(result.likeCount);
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        aria-pressed={liked}
        aria-label={liked ? "いいねを取り消す" : "いいねする"}
        className={`flex w-full items-center justify-center gap-2 rounded-lg border py-2.5 text-[13px] font-medium transition disabled:opacity-60 ${
          liked
            ? "border-accent-signal/40 bg-accent-signal/10 text-accent-signal"
            : "border-border bg-bg text-text-secondary hover:bg-surface-raised"
        }`}
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill={liked ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0"
        >
          <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 1 0-7.8 7.8l1.1 1L12 21l7.7-7.7 1.1-1a5.5 5.5 0 0 0 0-7.8Z" />
        </svg>
        {liked ? "いいね済み" : "いいね"}
        {count > 0 && (
          <span className="font-mono text-[12px] opacity-80">{count}</span>
        )}
      </button>

      {error && (
        <p className="mt-2 text-[12px] text-accent-danger">{error}</p>
      )}
    </div>
  );
}
