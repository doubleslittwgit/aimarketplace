"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { startTip, TIP_AMOUNTS } from "@/app/apps/[slug]/tip-actions";

export default function TipBox({
  toolId,
  slug,
  isLoggedIn,
  isOwner,
}: {
  toolId: string;
  slug: string;
  isLoggedIn: boolean;
  isOwner: boolean;
}) {
  const t = useTranslations("tip");
  const router = useRouter();
  const [selected, setSelected] = useState<number>(TIP_AMOUNTS[1]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // 自分のツールにはチップを送れないので、出品者本人には出さない
  if (isOwner) return null;

  function handleTip() {
    if (!isLoggedIn) {
      router.push(`/login?next=/apps/${slug}`);
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await startTip(toolId, selected);
      // 成功時はStripeへ遷移するので、ここに戻ってくるのは失敗時だけ
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <h3 className="font-display text-[14px] font-semibold text-text-primary">
        {t("title")}
      </h3>
      <p className="mt-1 text-[12px] leading-relaxed text-text-muted">{t("subtitle")}</p>

      <div className="mt-3 grid grid-cols-4 gap-1.5">
        {TIP_AMOUNTS.map((amount) => (
          <button
            key={amount}
            type="button"
            onClick={() => setSelected(amount)}
            className={`rounded-lg border py-2 font-mono text-[12px] transition ${
              selected === amount
                ? "border-accent-signal/40 bg-accent-signal/10 text-accent-signal"
                : "border-border text-text-secondary hover:border-border-strong"
            }`}
          >
            ¥{amount.toLocaleString()}
          </button>
        ))}
      </div>

      {error && <p className="mt-2 text-[12px] text-accent-danger">{error}</p>}

      <button
        type="button"
        onClick={handleTip}
        disabled={isPending}
        className="mt-3 w-full rounded-lg bg-accent-signal py-2.5 text-[13px] font-medium text-white transition hover:brightness-105 disabled:opacity-60"
      >
        {isPending ? t("sending") : t("button")}
      </button>

      <p className="mt-2 text-[11px] leading-relaxed text-text-dim">{t("feeNote")}</p>
    </div>
  );
}
