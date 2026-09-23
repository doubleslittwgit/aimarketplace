"use client";

import { useState, useTransition } from "react";
import { cleanupUnusedCourseImages } from "@/app/admin/courses/actions";

function formatBytes(n: number) {
  return n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)}MB` : `${Math.round(n / 1024)}KB`;
}

export default function CleanupImagesButton({ count, bytes }: { count: number; bytes: number }) {
  const [result, setResult] = useState<string | null>(null);
  const [isPending, start] = useTransition();

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3.5">
      <div>
        <p className="text-[13px] font-medium text-text-primary">Academy の未使用画像</p>
        <p className="mt-0.5 text-[12px] text-text-dim">
          保存されなかった書きかけ・差し替え前の画像（1時間以上前のもの）：
          {count > 0 ? ` ${count}枚（${formatBytes(bytes)}）` : " なし"}
        </p>
        {result && <p className="mt-1 text-[12px] text-accent-success">{result}</p>}
      </div>
      <button
        type="button"
        disabled={isPending || count === 0}
        onClick={() =>
          start(async () => {
            const r = await cleanupUnusedCourseImages();
            setResult(r.error ? `エラー: ${r.error}` : `${r.removed}枚（${formatBytes(r.bytes)}）を削除しました`);
          })
        }
        className="shrink-0 rounded-lg border border-border px-3.5 py-2 text-[12px] text-text-secondary transition hover:bg-surface-raised disabled:opacity-50"
      >
        {isPending ? "削除中…" : "削除する"}
      </button>
    </div>
  );
}
