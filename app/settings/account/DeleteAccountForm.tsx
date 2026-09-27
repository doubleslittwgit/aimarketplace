"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { deleteAccount } from "./actions";

export default function DeleteAccountForm({ email }: { email: string }) {
  const t = useTranslations("accountSettings");
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const matches = typed.trim().toLowerCase() === email.toLowerCase() && email !== "";

  return (
    <form
      action={(formData) => {
        if (!window.confirm(t("deleteFinalConfirm"))) return;
        setError(null);
        startTransition(async () => {
          const result = await deleteAccount(formData);
          if (result?.error) setError(result.error);
        });
      }}
      className="mt-4 space-y-3"
    >
      <label className="block text-[13px] text-text-secondary">
        {t("deleteTypeEmail")}
        <input
          name="confirmEmail"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          placeholder={email}
          className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-[14px] text-text-primary outline-none focus:border-border-strong"
        />
      </label>
      {error && <p className="text-[13px] text-accent-danger">{error}</p>}
      <button
        type="submit"
        disabled={!matches || isPending}
        className="rounded-lg bg-accent-danger px-4 py-2 text-[13px] font-medium text-white transition hover:brightness-105 disabled:opacity-50"
      >
        {isPending ? t("deleting") : t("deleteButton")}
      </button>
    </form>
  );
}
