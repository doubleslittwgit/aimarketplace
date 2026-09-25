"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import Stars from "@/components/academy/Stars";
import { upsertCourseReview, deleteCourseReview } from "@/app/academy/courses/[slug]/review-actions";

const INTL_LOCALE: Record<string, string> = { ja: "ja-JP", zh: "zh-TW", en: "en-US" };

export type CourseReview = {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  userId: string;
  authorName: string;
  authorHandle: string | null;
};

/**
 * 講座ページ下部のレビュー欄。
 * 書けるかどうか（canReview）はサーバー側で判定した結果を受け取るが、
 * 最終的な判定はデータベース（RLS）が行う。
 */
export default function CourseReviews({
  courseId,
  reviews,
  currentUserId,
  canReview,
  isPaid,
  loginHref,
}: {
  courseId: string;
  reviews: CourseReview[];
  currentUserId: string | null;
  canReview: boolean;
  isPaid: boolean;
  loginHref: string;
}) {
  const t = useTranslations("academyCourse.reviews");
  const locale = useLocale();
  const own = reviews.find((r) => r.userId === currentUserId) ?? null;
  const others = reviews.filter((r) => r.userId !== currentUserId);
  const [editing, setEditing] = useState(!own);
  const [rating, setRating] = useState(own?.rating ?? 0);
  const [comment, setComment] = useState(own?.comment ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const avg = reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : null;
  const formatDate = (iso: string) => new Date(iso).toLocaleDateString(INTL_LOCALE[locale] ?? "ja-JP");

  function submit() {
    if (rating < 1) {
      setError(t("errors.pickRating"));
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await upsertCourseReview(courseId, rating, comment);
      if (result.error) setError(result.error);
      else setEditing(false);
    });
  }

  function remove() {
    if (!window.confirm(t("confirmDelete"))) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteCourseReview(courseId);
      if (result.error) setError(result.error);
      else {
        setRating(0);
        setComment("");
        setEditing(true);
      }
    });
  }

  return (
    <section id="reviews" className="mt-12 scroll-mt-24">
      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 className="font-display text-[20px] font-bold text-text-primary">{t("title")}</h2>
        {avg !== null && (
          <span className="flex items-center gap-1.5">
            <Stars value={avg} size={15} label={t("avgLabel", { avg: avg.toFixed(1) })} />
            <span className="text-[13px] font-semibold text-text-primary">{avg.toFixed(1)}</span>
            <span className="text-[12px] text-text-muted">{t("count", { n: reviews.length })}</span>
          </span>
        )}
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-accent-danger/30 bg-accent-danger/5 px-3.5 py-2.5 text-[13px] text-accent-danger">
          {error}
        </p>
      )}

      {/* 書く欄 */}
      {canReview ? (
        <div className="mb-6 rounded-xl border border-border bg-surface p-4">
          {own && !editing ? (
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="mb-1 text-[12px] text-text-muted">{t("yours")}</p>
                <Stars value={own.rating} size={15} />
                {own.comment && (
                  <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-text-secondary">{own.comment}</p>
                )}
              </div>
              <div className="flex shrink-0 gap-3 text-[12px]">
                <button type="button" onClick={() => setEditing(true)} className="text-[#9C7A12] hover:underline">
                  {t("edit")}
                </button>
                <button
                  type="button"
                  onClick={remove}
                  disabled={isPending}
                  className="text-accent-danger hover:underline disabled:opacity-60"
                >
                  {t("delete")}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p className="mb-2 text-[13px] font-medium text-text-primary">{own ? t("editTitle") : t("writeTitle")}</p>
              <Stars value={rating} onChange={setRating} size={24} label={t("ratingLabel")} />
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                maxLength={1000}
                placeholder={t("placeholder")}
                className="mt-3 w-full resize-y rounded-lg border border-border bg-bg px-3 py-2 text-[13px] text-text-primary outline-none placeholder:text-text-dim focus:border-border-strong"
              />
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={submit}
                  disabled={isPending}
                  className="rounded-lg bg-[#173F35] px-4 py-2 text-[12px] font-semibold text-[#F7F3E8] transition hover:brightness-110 disabled:opacity-60"
                >
                  {isPending ? t("submitting") : t("submit")}
                </button>
                {own && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(false);
                      setRating(own.rating);
                      setComment(own.comment ?? "");
                      setError(null);
                    }}
                    className="rounded-lg border border-border px-4 py-2 text-[12px] text-text-secondary hover:bg-surface-raised"
                  >
                    {t("cancel")}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      ) : !currentUserId ? (
        <p className="mb-6 text-[12px] text-text-muted">
          <Link href={loginHref} className="font-medium text-[#9C7A12] hover:underline">
            {t("loginToReview")}
          </Link>
        </p>
      ) : isPaid ? (
        <p className="mb-6 text-[12px] text-text-muted">{t("purchaseToReview")}</p>
      ) : null}

      {/* 一覧 */}
      {others.length === 0 && !own ? (
        <p className="rounded-xl border border-dashed border-border-strong bg-surface px-4 py-6 text-center text-[13px] text-text-muted">
          {t("empty")}
        </p>
      ) : (
        <ul className="space-y-4">
          {others.map((r) => (
            <li key={r.id} className="border-b border-border pb-4 last:border-b-0">
              <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                {r.authorHandle ? (
                  <Link href={`/u/${r.authorHandle}`} className="text-[13px] font-medium text-text-primary hover:underline">
                    {r.authorName}
                  </Link>
                ) : (
                  <span className="text-[13px] font-medium text-text-primary">{r.authorName}</span>
                )}
                <Stars value={r.rating} size={13} />
                <span className="text-[11px] text-text-dim">{formatDate(r.createdAt)}</span>
              </div>
              {r.comment && (
                <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-text-secondary">{r.comment}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
