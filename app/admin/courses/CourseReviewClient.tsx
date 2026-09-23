"use client";

import { useState, useTransition } from "react";
import { approveCourse, rejectCourse } from "./actions";

export type PendingCourse = {
  id: string;
  slug: string;
  title: string;
  price: number;
  toc: { level: number; text: string }[] | null;
  updated_at: string;
  profiles: { display_name: string | null; handle: string | null } | null;
};

export default function CourseReviewClient({ courses }: { courses: PendingCourse[] }) {
  const [items, setItems] = useState(courses);
  if (items.length === 0) {
    return (
      <div className="mt-6 rounded-xl border border-border bg-surface p-8 text-center text-[13px] text-text-muted">
        審査待ちの講座はありません
      </div>
    );
  }
  return (
    <div className="mt-6 space-y-3">
      {items.map((c) => (
        <Row key={c.id} course={c} onDone={() => setItems((prev) => prev.filter((x) => x.id !== c.id))} />
      ))}
    </div>
  );
}

function Row({ course, onDone }: { course: PendingCourse; onDone: () => void }) {
  const [isPending, start] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<{ error: string | null }>) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (r.error) setError(r.error);
      else onDone();
    });

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-text-primary">{course.title || "（タイトル未設定）"}</p>
          <p className="mt-0.5 text-[12px] text-text-muted">
            {course.profiles?.display_name || course.profiles?.handle || "—"} ・{" "}
            {course.price > 0 ? `¥${course.price.toLocaleString()}` : "無料"} ・ 目次 {course.toc?.length ?? 0} 項目 ・{" "}
            {new Date(course.updated_at).toLocaleString("ja-JP")}
          </p>
        </div>
        <a
          href={`/academy/courses/${course.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-[12px] text-text-secondary hover:bg-surface-raised"
        >
          全文をプレビュー ↗
        </a>
      </div>

      {rejecting ? (
        <div className="mt-3 space-y-2">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="差し戻しの理由（作者に通知されます）"
            className="w-full resize-none rounded-lg border border-border bg-bg px-3 py-2 text-[13px] text-text-primary outline-none focus:border-border-strong"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={() => run(() => rejectCourse(course.id, reason))}
              className="rounded-lg bg-accent-danger px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-60"
            >
              差し戻す
            </button>
            <button type="button" onClick={() => setRejecting(false)} className="text-[12px] text-text-muted">
              キャンセル
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={() => run(() => approveCourse(course.id))}
            className="rounded-lg bg-accent-success px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-60"
          >
            {isPending ? "処理中…" : "承認して公開"}
          </button>
          <button
            type="button"
            onClick={() => setRejecting(true)}
            className="rounded-lg border border-border px-3 py-1.5 text-[12px] text-text-secondary hover:bg-surface-raised"
          >
            差し戻す
          </button>
        </div>
      )}
      {error && <p className="mt-2 text-[12px] text-accent-danger">{error}</p>}
    </div>
  );
}
