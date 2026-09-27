"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import * as Sentry from "@sentry/nextjs";

/**
 * ページの表示中にエラーが起きたときの画面。
 * Next.js 標準の真っ白な画面の代わりに、BuildBay の中だと分かる画面と「もう一度読み込む」を出す。
 * エラーの内容は Sentry に送る（利用者には詳細を見せず、問い合わせ用のIDだけ出す）。
 */
export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const t = useTranslations("errorPage");

  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <main className="flex flex-1 items-center">
      <div className="mx-auto flex max-w-xl flex-col items-center px-6 py-20 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-512.png" alt="" width={512} height={512} className="h-16 w-16 opacity-90" />
        <h1 className="mt-6 font-display text-2xl font-semibold text-text-primary">{t("title")}</h1>
        <p className="mt-3 text-[14px] leading-relaxed text-text-secondary">{t("body")}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => retry()}
            className="rounded-full bg-accent-signal px-6 py-2.5 text-[14px] font-medium text-white transition hover:brightness-110"
          >
            {t("retry")}
          </button>
          <Link
            href="/"
            className="rounded-full border border-border bg-bg px-6 py-2.5 text-[14px] font-medium text-text-primary transition hover:bg-surface"
          >
            {t("home")}
          </Link>
        </div>
        {error.digest && <p className="mt-6 font-mono text-[11px] text-text-dim">ID: {error.digest}</p>}
      </div>
    </main>
  );
}
