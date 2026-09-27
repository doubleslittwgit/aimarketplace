"use client";

import { useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { requestPasswordReset } from "@/app/auth/actions";

export default function ForgotPasswordForm() {
  const t = useTranslations("auth.reset");
  const tAuth = useTranslations("auth");
  const expired = useSearchParams().get("error") === "expired";
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (sent) {
    return (
      <div className="rounded-lg border border-accent-success/30 bg-accent-success/10 px-4 py-3.5 text-[13px] leading-relaxed text-accent-success">
        {t("sent")}
      </div>
    );
  }

  return (
    <form
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const result = await requestPasswordReset(formData);
          if (result.error) setError(result.error);
          else setSent(true);
        });
      }}
      className="space-y-4"
    >
      {expired && (
        <div className="rounded-lg border border-accent-danger/30 bg-accent-danger/10 px-3.5 py-2.5 text-[13px] text-accent-danger">
          {t("expired")}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-accent-danger/30 bg-accent-danger/10 px-3.5 py-2.5 text-[13px] text-accent-danger">
          {error}
        </div>
      )}
      <div>
        <label className="mb-1.5 block text-[13px] font-medium text-text-secondary">{tAuth("email")}</label>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-[14px] text-text-primary outline-none placeholder:text-text-dim focus:border-border-strong"
        />
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-lg bg-accent-signal py-2.5 text-sm font-medium text-white transition hover:brightness-105 disabled:opacity-60"
      >
        {isPending ? t("sending") : t("send")}
      </button>
    </form>
  );
}
