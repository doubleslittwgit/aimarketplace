"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { reportTool } from "@/app/apps/[slug]/report-actions";

const REASON_KEYS = ["malware", "misrepresentation", "copyright", "spam", "other"] as const;

export default function ReportButton({ toolId, slug }: { toolId: string; slug: string }) {
  const t = useTranslations("toolDetail.reportButton");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  function submit() {
    setError(null);
    if (!reason) {
      setError(t("reasonRequired"));
      return;
    }
    startTransition(async () => {
      const result = await reportTool(toolId, reason, detail);
      if (!result.ok) {
        if (result.needsLogin) {
          router.push(`/login?next=${encodeURIComponent(`/apps/${slug}`)}`);
          return;
        }
        setError(result.error);
        return;
      }
      setDone(true);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[12px] text-text-dim transition hover:text-accent-danger"
      >
        {t("trigger")}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => !isPending && setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-border bg-bg p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {done ? (
              <div className="py-4 text-center">
                <p className="mb-1 text-[14px] font-medium text-text-primary">
                  {t("doneTitle")}
                </p>
                <p className="mb-4 text-[13px] text-text-muted">
                  {t("doneBody")}
                </p>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-border px-4 py-2 text-[13px] text-text-secondary hover:bg-surface"
                >
                  {t("close")}
                </button>
              </div>
            ) : (
              <>
                <h2 className="mb-3 font-display text-[15px] font-semibold text-text-primary">
                  {t("modalTitle")}
                </h2>

                <div className="mb-3 space-y-1.5">
                  {REASON_KEYS.map((key) => (
                    <label
                      key={key}
                      className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-[13px] text-text-secondary has-[:checked]:border-accent-signal/40 has-[:checked]:bg-accent-signal-dim has-[:checked]:text-accent-signal"
                    >
                      <input
                        type="radio"
                        name="report-reason"
                        value={key}
                        checked={reason === key}
                        onChange={() => setReason(key)}
                        className="h-3.5 w-3.5"
                      />
                      {t(`reasons.${key}`)}
                    </label>
                  ))}
                </div>

                <textarea
                  value={detail}
                  onChange={(e) => setDetail(e.target.value)}
                  rows={3}
                  placeholder={t("detailPlaceholder")}
                  className="mb-3 w-full resize-none rounded-lg border border-border bg-surface px-3 py-2 text-[13px] text-text-primary outline-none placeholder:text-text-dim"
                />

                {error && (
                  <p className="mb-3 text-[12px] text-accent-danger">{error}</p>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={submit}
                    disabled={isPending}
                    className="flex-1 rounded-lg bg-accent-danger px-4 py-2 text-[13px] font-medium text-white transition hover:brightness-105 disabled:opacity-60"
                  >
                    {isPending ? t("submitting") : t("submit")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    disabled={isPending}
                    className="rounded-lg border border-border px-4 py-2 text-[13px] text-text-secondary hover:bg-surface"
                  >
                    {t("cancel")}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
