"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { submitRefundRequest } from "@/app/dashboard/refund-actions";

export default function ReportTroubleButton({
  purchaseId,
  toolName,
  alreadySubmitted,
  kind = "tool",
}: {
  purchaseId: string;
  toolName: string;
  alreadySubmitted: boolean;
  /** "course" なら講座の購入への報告 */
  kind?: "tool" | "course";
}) {
  const t = useTranslations("refundRequest");
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(alreadySubmitted);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (submitted) {
    return (
      <span className="shrink-0 text-[12px] text-text-dim">{t("submittedNotice")}</span>
    );
  }

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await submitRefundRequest(purchaseId, message, kind);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSubmitted(true);
      setOpen(false);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="shrink-0 text-[12px] text-text-dim underline-offset-2 hover:text-text-secondary hover:underline"
      >
        {t("reportButton")}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-text-primary/40 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-bg p-6 shadow-xl">
            <h2 className="mb-1 font-display text-[15px] font-semibold text-text-primary">
              {t("modalTitle")}
            </h2>
            <p className="mb-4 text-[12px] text-text-muted">
              {t("modalSubtitle", { toolName })}
            </p>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              maxLength={1000}
              placeholder={t("messagePlaceholder")}
              className="w-full resize-none rounded-lg border border-border bg-surface px-3.5 py-2.5 text-[13px] text-text-primary outline-none focus:border-border-strong"
            />
            {error && <p className="mt-2 text-[12px] text-accent-danger">{error}</p>}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isPending || !message.trim()}
                className="flex-1 rounded-lg bg-accent-signal py-2.5 text-[13px] font-medium text-white transition hover:brightness-105 disabled:opacity-60"
              >
                {isPending ? t("submitting") : t("submit")}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-border px-4 py-2.5 text-[13px] font-medium text-text-secondary transition hover:bg-surface"
              >
                {t("cancel")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
