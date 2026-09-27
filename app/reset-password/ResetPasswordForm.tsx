"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { updatePassword } from "@/app/auth/actions";

export default function ResetPasswordForm() {
  const t = useTranslations("auth.reset");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputClass =
    "w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-[14px] text-text-primary outline-none placeholder:text-text-dim focus:border-border-strong";

  return (
    <form
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const result = await updatePassword(formData);
          if (result?.error) setError(result.error);
        });
      }}
      className="space-y-4"
    >
      {error && (
        <div className="rounded-lg border border-accent-danger/30 bg-accent-danger/10 px-3.5 py-2.5 text-[13px] text-accent-danger">
          {error}
        </div>
      )}
      <div>
        <label className="mb-1.5 block text-[13px] font-medium text-text-secondary">{t("newPassword")}</label>
        <input type="password" name="password" required minLength={8} autoComplete="new-password" className={inputClass} />
        <p className="mt-1 text-[11px] text-text-dim">{t("passwordHint")}</p>
      </div>
      <div>
        <label className="mb-1.5 block text-[13px] font-medium text-text-secondary">{t("confirmPassword")}</label>
        <input type="password" name="confirm" required minLength={8} autoComplete="new-password" className={inputClass} />
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-lg bg-accent-signal py-2.5 text-sm font-medium text-white transition hover:brightness-105 disabled:opacity-60"
      >
        {isPending ? t("saving") : t("save")}
      </button>
    </form>
  );
}
