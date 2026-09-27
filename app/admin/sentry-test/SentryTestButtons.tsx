"use client";

import { useState, useTransition } from "react";
import * as Sentry from "@sentry/nextjs";
import { triggerServerTestError } from "./actions";

export default function SentryTestButtons() {
  const [status, setStatus] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function browserError() {
    const eventId = Sentry.captureException(new Error("BuildBay Sentry test (browser)"));
    setStatus(
      Sentry.isEnabled()
        ? `ブラウザのテストエラーを送りました（ID: ${eventId}）`
        : "Sentry が有効になっていません（NEXT_PUBLIC_SENTRY_DSN が設定されていないか、再デプロイ前です）"
    );
  }

  function serverError() {
    startTransition(async () => {
      try {
        await triggerServerTestError();
      } catch {
        // わざと起こしたエラーなので、画面には結果だけ出す
      }
      setStatus("サーバーのテストエラーを起こしました");
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={browserError}
          className="rounded-lg bg-accent-signal px-4 py-2 text-[13px] font-semibold text-white transition hover:brightness-110"
        >
          ブラウザのエラーを送る
        </button>
        <button
          type="button"
          onClick={serverError}
          disabled={isPending}
          className="rounded-lg border border-border px-4 py-2 text-[13px] text-text-primary transition hover:bg-surface disabled:opacity-60"
        >
          {isPending ? "送信中…" : "サーバーのエラーを送る"}
        </button>
      </div>
      {status && (
        <p role="status" className="rounded-lg border border-border bg-surface px-4 py-2.5 text-[13px] text-text-secondary">
          {status}
        </p>
      )}
    </div>
  );
}
