"use client";

import { useState, useTransition } from "react";
import { backfillMinimumPayoutBalances } from "../backfill-actions";

export default function BackfillPayoutsClient() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<
    { accountId: string; ok: boolean; message?: string }[] | null
  >(null);

  function run() {
    setError(null);
    setResults(null);
    startTransition(async () => {
      const result = await backfillMinimumPayoutBalances();
      if (result.error !== null) {
        setError(result.error);
      } else {
        setResults(result.results);
      }
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={run}
        disabled={isPending}
        className="rounded-lg bg-accent-signal px-4 py-2.5 text-[13px] font-medium text-white transition hover:brightness-105 disabled:opacity-60"
      >
        {isPending ? "実行中..." : "実行する"}
      </button>

      {error && (
        <p className="mt-4 text-[13px] text-accent-danger">{error}</p>
      )}

      {results && (
        <div className="mt-6 space-y-1.5">
          <p className="text-[13px] font-medium text-text-primary">
            {results.length}件を処理しました
          </p>
          {results.map((r) => (
            <div
              key={r.accountId}
              className={`rounded-lg border px-3 py-2 font-mono text-[12px] ${
                r.ok
                  ? "border-accent-success/30 bg-accent-success/5 text-accent-success"
                  : "border-accent-danger/30 bg-accent-danger/5 text-accent-danger"
              }`}
            >
              {r.accountId}: {r.ok ? "成功" : `失敗 (${r.message})`}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
