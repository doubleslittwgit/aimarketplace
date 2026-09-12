"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startCheckout } from "@/app/apps/[slug]/checkout-actions";
import { claimFreeTool } from "@/app/apps/[slug]/free-actions";

type Props = {
  toolId: string;
  isFree: boolean;
  isLoggedIn: boolean;
  isOwner: boolean;
  isPurchased: boolean;
};

export default function PurchaseButton({
  toolId,
  isFree,
  isLoggedIn,
  isOwner,
  isPurchased,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // 自分が出品したツールには、購入ボタンではなく状態表示を出す
  if (isOwner) {
    return (
      <div className="mb-3 w-full rounded-lg border border-border bg-surface-raised py-3 text-center text-sm text-text-muted">
        あなたが出品したツールです
      </div>
    );
  }

  if (isPurchased) {
    return (
      <a
        href={`/apps/download/${toolId}`}
        className="mb-3 block w-full rounded-lg bg-accent-success py-3 text-center text-sm font-medium text-white transition hover:brightness-105"
      >
        ダウンロード
      </a>
    );
  }

  function handleClick() {
    setError(null);

    if (!isLoggedIn) {
      router.push("/login");
      return;
    }

    startTransition(async () => {
      const result = isFree
        ? await claimFreeTool(toolId)
        : await startCheckout(toolId);
      // 成功時はリダイレクトされるため、ここに戻ってくるのはエラー時のみ
      if (result?.error) setError(result.error);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="mb-3 w-full rounded-lg bg-accent-signal py-3 text-sm font-medium text-white transition hover:brightness-105 disabled:opacity-60"
      >
        {isPending
          ? "処理中..."
          : isFree
            ? "無料でダウンロード"
            : "購入してダウンロード"}
      </button>

      {error && (
        <p className="mb-3 rounded-lg border border-accent-danger/30 bg-accent-danger/10 px-3 py-2 text-[12px] text-accent-danger">
          {error}
        </p>
      )}
    </>
  );
}
