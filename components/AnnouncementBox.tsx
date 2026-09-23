"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { sendAnnouncement } from "@/app/dashboard/announcement-actions";

export default function AnnouncementBox({ followerCount }: { followerCount: number }) {
  const t = useTranslations("announcement");
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [isPending, startTransition] = useTransition();

  // フォロワーが誰もいないうちは、送る先が無いので出さない
  if (followerCount === 0) return null;

  function handleSend() {
    setError(null);
    startTransition(async () => {
      const result = await sendAnnouncement(message);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSent(true);
      setMessage("");
      setOpen(false);
    });
  }

  return (
    <section className="mb-8 rounded-xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-[15px] font-semibold text-text-primary">
            {t("title")}
          </h2>
          <p className="mt-0.5 text-[12px] text-text-muted">
            {t("subtitle", { count: followerCount })}
          </p>
        </div>
        {!open && (
          <button
            type="button"
            onClick={() => {
              setOpen(true);
              setSent(false);
            }}
            className="shrink-0 rounded-lg border border-border px-3.5 py-2 text-[13px] font-medium text-text-secondary transition hover:bg-surface-raised"
          >
            {t("compose")}
          </button>
        )}
      </div>

      {sent && <p className="mt-3 text-[12px] text-accent-success">{t("sent")}</p>}

      {open && (
        <div className="mt-4">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            maxLength={500}
            placeholder={t("placeholder")}
            className="w-full resize-none rounded-lg border border-border bg-bg px-3.5 py-2.5 text-[13px] text-text-primary outline-none focus:border-border-strong"
          />
          {error && <p className="mt-2 text-[12px] text-accent-danger">{error}</p>}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={handleSend}
              disabled={isPending || !message.trim()}
              className="rounded-lg bg-accent-signal px-4 py-2 text-[13px] font-medium text-white transition hover:brightness-105 disabled:opacity-60"
            >
              {isPending ? t("sending") : t("send")}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg border border-border px-4 py-2 text-[13px] text-text-secondary transition hover:bg-surface-raised"
            >
              {t("cancel")}
            </button>
          </div>
          <p className="mt-2 text-[12px] text-text-dim">{t("note")}</p>
        </div>
      )}
    </section>
  );
}
