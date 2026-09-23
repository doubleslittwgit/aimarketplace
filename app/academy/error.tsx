"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

/**
 * Academy の中でページの表示に失敗したときの受け皿。
 * 何も分からないエラーページを出す代わりに、再試行の手段と、
 * 原因を調べるための識別番号（digest）を表示する。
 */
export default function AcademyError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("academyEditor");

  useEffect(() => {
    console.error("[academy] render error:", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-6 text-center">
      <p className="font-display text-xl font-semibold text-text-primary">{t("pageError.title")}</p>
      <p className="mt-2 text-[13px] leading-relaxed text-text-muted">{t("pageError.body")}</p>
      {error.digest && (
        <p className="mt-3 rounded-md bg-surface px-2 py-1 font-mono text-[11px] text-text-dim">
          ID: {error.digest}
        </p>
      )}
      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-full bg-accent-signal px-5 py-2.5 text-[13px] font-medium text-white transition hover:brightness-110"
        >
          {t("pageError.retry")}
        </button>
        <Link
          href="/academy"
          className="rounded-full border border-border px-5 py-2.5 text-[13px] text-text-secondary transition hover:bg-surface"
        >
          {t("pageError.home")}
        </Link>
      </div>
    </div>
  );
}
