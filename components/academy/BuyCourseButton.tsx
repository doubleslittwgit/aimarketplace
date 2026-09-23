"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { startCoursePurchase } from "@/app/academy/courses/[slug]/purchase-actions";

export default function BuyCourseButton({
  courseId,
  enabled,
  label,
}: {
  courseId: string;
  /** 購入機能が有効で、作者が売上を受け取れる状態か */
  enabled: boolean;
  label: string;
}) {
  const t = useTranslations("academyCourse");
  const [error, setError] = useState<string | null>(null);
  const [isPending, start] = useTransition();

  return (
    <>
      <button
        type="button"
        disabled={!enabled || isPending}
        onClick={() =>
          start(async () => {
            setError(null);
            // 成功時はStripeへ移動するので、戻ってくるのは失敗時だけ
            const result = await startCoursePurchase(courseId);
            if (result?.error) setError(result.error);
          })
        }
        className="mt-3 w-full rounded-lg bg-accent-signal py-3 text-[14px] font-bold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? t("redirecting") : label}
      </button>
      {error && <p className="mt-2 text-[12px] text-accent-danger">{error}</p>}
    </>
  );
}
