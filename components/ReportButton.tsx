"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { reportTool } from "@/app/apps/[slug]/report-actions";

const REASONS: { value: string; label: string }[] = [
  { value: "malware", label: "危険なコード・マルウェアの疑い" },
  { value: "misrepresentation", label: "説明と実際の内容が大きく異なる" },
  { value: "copyright", label: "著作権・知的財産権の侵害" },
  { value: "spam", label: "スパム・詐欺的な出品" },
  { value: "other", label: "その他" },
];

export default function ReportButton({ toolId, slug }: { toolId: string; slug: string }) {
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
      setError("通報理由を選んでください");
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
        このツールを通報する
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
                  通報を受け付けました
                </p>
                <p className="mb-4 text-[13px] text-text-muted">
                  ご協力ありがとうございます。運営が確認します。
                </p>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-border px-4 py-2 text-[13px] text-text-secondary hover:bg-surface"
                >
                  閉じる
                </button>
              </div>
            ) : (
              <>
                <h2 className="mb-3 font-display text-[15px] font-semibold text-text-primary">
                  このツールを通報する
                </h2>

                <div className="mb-3 space-y-1.5">
                  {REASONS.map((r) => (
                    <label
                      key={r.value}
                      className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-[13px] text-text-secondary has-[:checked]:border-accent-signal/40 has-[:checked]:bg-accent-signal-dim has-[:checked]:text-accent-signal"
                    >
                      <input
                        type="radio"
                        name="report-reason"
                        value={r.value}
                        checked={reason === r.value}
                        onChange={() => setReason(r.value)}
                        className="h-3.5 w-3.5"
                      />
                      {r.label}
                    </label>
                  ))}
                </div>

                <textarea
                  value={detail}
                  onChange={(e) => setDetail(e.target.value)}
                  rows={3}
                  placeholder="補足（任意）"
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
                    {isPending ? "送信中..." : "通報する"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    disabled={isPending}
                    className="rounded-lg border border-border px-4 py-2 text-[13px] text-text-secondary hover:bg-surface"
                  >
                    キャンセル
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
