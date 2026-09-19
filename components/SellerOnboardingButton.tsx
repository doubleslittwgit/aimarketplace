"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { startSellerOnboarding, openSellerDashboard } from "@/app/seller/actions";

type Props = {
  /** onboarding: 登録を開始/再開する / dashboard: Stripeの管理画面を開く */
  action: "onboarding" | "dashboard";
  label: string;
  variant?: "primary" | "secondary";
};

export default function SellerOnboardingButton({
  action,
  label,
  variant = "primary",
}: Props) {
  const t = useTranslations("common");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result =
        action === "onboarding"
          ? await startSellerOnboarding()
          : await openSellerDashboard();
      // 成功時はサーバー側でStripeへリダイレクトされるため、ここには戻ってこない
      if (result?.error) setError(result.error);
    });
  }

  const className =
    variant === "primary"
      ? "w-full rounded-lg bg-accent-signal py-2.5 text-[13px] font-medium text-white transition hover:brightness-105 disabled:opacity-60"
      : "w-full rounded-lg border border-border bg-bg py-2.5 text-[13px] font-medium text-text-secondary transition hover:bg-surface-raised disabled:opacity-60";

  return (
    <div>
      {error && (
        <div className="mb-3 rounded-lg border border-accent-danger/30 bg-accent-danger/5 px-3.5 py-2.5 text-left text-[13px] text-accent-danger">
          {error}
        </div>
      )}
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className={className}
      >
        {isPending ? t("processing") : label}
      </button>
    </div>
  );
}
