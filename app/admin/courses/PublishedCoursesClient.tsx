"use client";

import { useState, useTransition } from "react";
import { unpublishCourseByAdmin } from "./actions";

export type PublishedCourse = {
  id: string;
  slug: string;
  title: string;
  price: number;
  status: "published" | "suspended";
  rejection_reason: string | null;
  published_at: string | null;
  profiles: { display_name: string | null; handle: string | null } | null;
};

/** 公開中の講座の一覧。問題のある講座を、理由を付けて運営として非公開にできる */
export default function PublishedCoursesClient({ courses }: { courses: PublishedCourse[] }) {
  if (courses.length === 0) {
    return (
      <div className="mt-4 rounded-xl border border-border bg-surface p-6 text-center text-[13px] text-text-muted">
        公開中の講座はありません
      </div>
    );
  }
  return (
    <div className="mt-4 space-y-2">
      {courses.map((c) => (
        <Row key={c.id} course={c} />
      ))}
    </div>
  );
}

function Row({ course }: { course: PublishedCourse }) {
  const [isPending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [takenDown, setTakenDown] = useState(Boolean(course.status === "suspended" && course.rejection_reason));

  function submit() {
    start(async () => {
      setError(null);
      const r = await unpublishCourseByAdmin(course.id, reason);
      if (r.error) setError(r.error);
      else {
        setTakenDown(true);
        setOpen(false);
      }
    });
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <a
            href={`/academy/courses/${course.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[13px] font-medium text-text-primary hover:underline"
          >
            {course.title}
          </a>
          <p className="mt-0.5 text-[11px] text-text-muted">
            {course.profiles?.display_name || course.profiles?.handle || "—"} ・{" "}
            {course.price > 0 ? `¥${course.price.toLocaleString()}` : "無料"}
            {course.status === "suspended" && !takenDown && " ・ 作者が非公開中"}
          </p>
        </div>
        {takenDown ? (
          <span className="rounded-full bg-accent-danger/10 px-2 py-0.5 text-[11px] text-accent-danger">運営が非公開にしました</span>
        ) : (
          !open && (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="rounded-lg border border-accent-danger/40 px-3 py-1 text-[12px] text-accent-danger hover:bg-accent-danger/5"
            >
              非公開にする
            </button>
          )
        )}
      </div>
      {open && !takenDown && (
        <div className="mt-2 space-y-2">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="非公開にする理由（作者に通知されます）"
            className="w-full resize-none rounded-lg border border-border bg-bg px-3 py-2 text-[13px] text-text-primary outline-none focus:border-border-strong"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={submit}
              className="rounded-lg bg-accent-danger px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-60"
            >
              {isPending ? "処理中…" : "非公開にする"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="text-[12px] text-text-muted">
              キャンセル
            </button>
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-[12px] text-accent-danger">{error}</p>}
    </div>
  );
}
