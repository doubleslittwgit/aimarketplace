"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { startCheckout } from "@/app/apps/[slug]/checkout-actions";
import { claimFreeTool } from "@/app/apps/[slug]/free-actions";

type Props = {
  toolId: string;
  isFree: boolean;
  isLoggedIn: boolean;
  isOwner: boolean;
  isPurchased: boolean;
  isCloud: boolean;
};

export default function PurchaseButton({
  toolId,
  isFree,
  isLoggedIn,
  isOwner,
  isPurchased,
  isCloud,
}: Props) {
  const t = useTranslations("toolDetail.purchaseButton");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // 自分が出品したツールには、購入ボタンではなく状態表示を出す
  if (isOwner) {
    return (
      <div className="mb-3 w-full rounded-lg border border-border bg-surface-raised py-3 text-center text-sm text-text-muted">
        {t("ownerNotice")}
      </div>
    );
  }

  if (isPurchased) {
    return (
      <a
        href={`/apps/download/${toolId}`}
        // クラウド型は外部サイトへ移動するだけなので、BuildBayのタブは
        // 残したまま新しいタブで開く（ファイルのダウンロードは同じタブでよい）
        target={isCloud ? "_blank" : undefined}
        rel={isCloud ? "noopener noreferrer" : undefined}
        className="mb-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent-success py-3 text-center text-sm font-medium text-white transition hover:brightness-105"
      >
        {isCloud ? (
          <>
            {t("openInBrowser")}
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <path d="M15 3h6v6" />
              <path d="M10 14 21 3" />
            </svg>
          </>
        ) : (
          t("download")
        )}
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

  const actionLabel = isCloud
    ? isFree
      ? t("useFree")
      : t("usePaid")
    : isFree
      ? t("downloadFree")
      : t("downloadPaid");

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="mb-3 w-full rounded-lg bg-accent-signal py-3 text-sm font-medium text-white transition hover:brightness-105 disabled:opacity-60"
      >
        {isPending ? t("processing") : actionLabel}
      </button>

      {error && (
        <p className="mb-3 rounded-lg border border-accent-danger/30 bg-accent-danger/10 px-3 py-2 text-[12px] text-accent-danger">
          {error}
        </p>
      )}
    </>
  );
}
