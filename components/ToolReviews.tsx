"use client";

import { useState, useTransition } from "react";
import { useTranslations, useLocale } from "next-intl";
import { upsertReview, deleteReview } from "@/app/apps/[slug]/reviews-actions";

const INTL_LOCALE: Record<string, string> = { ja: "ja-JP", zh: "zh-TW", en: "en-US" };

type Review = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  author_id: string;
  author_name: string;
};

function Stars({
  value,
  onChange,
  size = 16,
}: {
  value: number;
  onChange?: (v: number) => void;
  size?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const interactive = Boolean(onChange);
  const shown = hover ?? value;

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          disabled={!interactive}
          onClick={() => onChange?.(i)}
          onMouseEnter={() => interactive && setHover(i)}
          onMouseLeave={() => interactive && setHover(null)}
          className={interactive ? "cursor-pointer" : "cursor-default"}
        >
          <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill={i <= shown ? "var(--accent-signal)" : "none"}
            stroke={i <= shown ? "var(--accent-signal)" : "var(--text-dim)"}
            strokeWidth="1.5"
          >
            <path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2Z" />
          </svg>
        </button>
      ))}
    </div>
  );
}

export default function ToolReviews({
  toolId,
  slug,
  reviews,
  currentUserId,
  isPurchased,
}: {
  toolId: string;
  slug: string;
  reviews: Review[];
  currentUserId: string | null;
  isPurchased: boolean;
}) {
  const t = useTranslations("toolDetail.reviews");
  const locale = useLocale();
  const ownReview = reviews.find((r) => r.author_id === currentUserId) ?? null;
  const [editing, setEditing] = useState(false);
  const [rating, setRating] = useState(ownReview?.rating ?? 5);
  const [comment, setComment] = useState(ownReview?.comment ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startSave] = useTransition();
  const [isDeleting, startDelete] = useTransition();

  const avg =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : null;

  function handleSubmit() {
    setError(null);
    startSave(async () => {
      const result = await upsertReview(toolId, slug, rating, comment);
      if (result?.error) setError(result.error);
      else setEditing(false);
    });
  }

  function handleDelete() {
    if (!ownReview) return;
    setError(null);
    startDelete(async () => {
      const result = await deleteReview(ownReview.id, slug);
      if (result?.error) setError(result.error);
      else {
        setEditing(false);
        setRating(5);
        setComment("");
      }
    });
  }

  return (
    <section className="mb-8">
      <div className="mb-4 flex items-center gap-3">
        <h2 className="font-display text-lg font-semibold text-text-primary">{t("title")}</h2>
        {avg !== null && (
          <div className="flex items-center gap-1.5">
            <Stars value={Math.round(avg)} size={14} />
            <span className="text-[13px] text-text-muted">
              {avg.toFixed(1)}{t("countSuffix", { count: reviews.length })}
            </span>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-accent-danger/30 bg-accent-danger/5 px-3.5 py-2.5 text-[13px] text-accent-danger">
          {error}
        </div>
      )}

      {/* 投稿・編集フォーム */}
      {isPurchased && (
        <div className="mb-6 rounded-xl border border-border bg-surface p-4">
          {!editing && ownReview ? (
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="mb-1 text-[12px] text-text-muted">{t("yourReview")}</p>
                <Stars value={ownReview.rating} size={14} />
                {ownReview.comment && (
                  <p className="mt-2 text-[13px] text-text-secondary">{ownReview.comment}</p>
                )}
              </div>
              <div className="flex shrink-0 gap-3 text-[12px]">
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="text-accent-signal hover:underline"
                >
                  {t("edit")}
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="text-accent-danger hover:underline disabled:opacity-60"
                >
                  {isDeleting ? t("deleting") : t("delete")}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p className="mb-2 text-[12px] text-text-muted">
                {ownReview ? t("editReview") : t("writeReview")}
              </p>
              <div className="mb-3">
                <Stars value={rating} onChange={setRating} size={22} />
              </div>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                placeholder={t("commentPlaceholder")}
                className="mb-3 w-full resize-none rounded-lg border border-border bg-bg px-3 py-2 text-[13px] text-text-primary outline-none placeholder:text-text-dim focus:border-border-strong"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSaving}
                  className="rounded-lg bg-accent-signal px-4 py-2 text-[12px] font-medium text-white transition hover:brightness-105 disabled:opacity-60"
                >
                  {isSaving ? t("submitting") : t("submit")}
                </button>
                {ownReview && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(false);
                      setRating(ownReview.rating);
                      setComment(ownReview.comment ?? "");
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
      )}

      {!isPurchased && currentUserId && (
        <p className="mb-6 text-[12px] text-text-dim">
          {t("purchaseToReview")}
        </p>
      )}

      {/* レビュー一覧（自分のもの以外） */}
      {reviews.filter((r) => r.author_id !== currentUserId).length === 0 && !ownReview ? (
        <p className="text-[13px] text-text-muted">{t("empty")}</p>
      ) : (
        <div className="space-y-4">
          {reviews
            .filter((r) => r.author_id !== currentUserId)
            .map((r) => (
              <div key={r.id} className="border-b border-border pb-4 last:border-b-0">
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-[13px] font-medium text-text-primary">
                    {r.author_name}
                  </span>
                  <Stars value={r.rating} size={13} />
                  <span className="text-[11px] text-text-dim">
                    {new Date(r.created_at).toLocaleDateString(INTL_LOCALE[locale] ?? "ja-JP")}
                  </span>
                </div>
                {r.comment && (
                  <p className="text-[13px] leading-relaxed text-text-secondary">{r.comment}</p>
                )}
              </div>
            ))}
        </div>
      )}
    </section>
  );
}
