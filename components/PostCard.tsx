"use client";

import { useEffect, useRef, useState, useTransition, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import {
  togglePostLike,
  deletePost,
  addComment,
  loadComments,
  deleteComment,
  reportPost,
  incrementPostView,
  type PostItem,
} from "@/app/feed/actions";

const REASON_KEYS = ["spam", "harassment", "illegal", "other"] as const;
const INTL_LOCALE: Record<string, string> = { ja: "ja-JP", zh: "zh-TW", en: "en-US" };
const VIEWED_KEY = "buildbay-feed-viewed-posts";

type Comment = {
  id: string;
  content: string;
  created_at: string;
  author: { display_name: string | null; handle: string; avatar_url: string | null };
};

export default function PostCard({
  post,
  isLoggedIn,
  onDeleted,
  initialComments,
  disableCardClick,
}: {
  post: PostItem;
  isLoggedIn: boolean;
  onDeleted: (id: string) => void;
  /** 投稿詳細ページ用: 最初からコメント一覧を展開した状態で渡す */
  initialComments?: Comment[];
  /** 投稿詳細ページ用: カード自体のクリックでの遷移を無効にする（既にそのページにいるため） */
  disableCardClick?: boolean;
}) {
  const t = useTranslations("feed");
  const tErrors = useTranslations("errors");
  const locale = useLocale();
  const router = useRouter();

  const [liked, setLiked] = useState(post.likedByMe);
  const [likeCount, setLikeCount] = useState(post.like_count);
  const [isLikePending, startLikeTransition] = useTransition();

  const [showComments, setShowComments] = useState(Boolean(initialComments));
  const [comments, setComments] = useState<Comment[] | null>(initialComments ?? null);
  const [commentCount, setCommentCount] = useState(post.comment_count);
  const [commentDraft, setCommentDraft] = useState("");
  const [isCommentPending, startCommentTransition] = useTransition();

  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDetail, setReportDetail] = useState("");
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportDone, setReportDone] = useState(false);
  const [isReportPending, startReportTransition] = useTransition();

  const [isDeletePending, startDeleteTransition] = useTransition();
  const [menuOpen, setMenuOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const cardRef = useRef<HTMLDivElement>(null);
  const postUrl = `/feed/${post.id}`;

  // フィード上に一定時間表示されたら1回だけ閲覧数を加算する
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;

    let viewed: Set<string>;
    try {
      viewed = new Set(JSON.parse(window.sessionStorage.getItem(VIEWED_KEY) || "[]"));
    } catch {
      viewed = new Set();
    }
    if (viewed.has(post.id)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          viewed.add(post.id);
          window.sessionStorage.setItem(VIEWED_KEY, JSON.stringify([...viewed]));
          incrementPostView(post.id);
          observer.disconnect();
        }
      },
      { threshold: 0.6 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [post.id]);

  function handleLike() {
    if (!isLoggedIn) {
      router.push(`/login?next=/feed`);
      return;
    }
    const next = !liked;
    setLiked(next);
    setLikeCount((n) => n + (next ? 1 : -1));
    startLikeTransition(async () => {
      const result = await togglePostLike(post.id);
      if (result.error) {
        setLiked(!next);
        setLikeCount((n) => n - (next ? 1 : -1));
      }
    });
  }

  function handleToggleComments() {
    setShowComments((v) => !v);
    if (!comments) {
      startCommentTransition(async () => {
        setComments(await loadComments(post.id));
      });
    }
  }

  function handleAddComment() {
    if (!isLoggedIn) {
      router.push(`/login?next=/feed`);
      return;
    }
    const content = commentDraft.trim();
    if (!content) return;
    startCommentTransition(async () => {
      const result = await addComment(post.id, content);
      if (result.comment) {
        setComments((prev) => [...(prev ?? []), result.comment!]);
        setCommentCount((n) => n + 1);
        setCommentDraft("");
      }
    });
  }

  function handleDeleteComment(commentId: string) {
    startCommentTransition(async () => {
      const result = await deleteComment(commentId);
      if (!result.error) {
        setComments((prev) => (prev ?? []).filter((c) => c.id !== commentId));
        setCommentCount((n) => Math.max(n - 1, 0));
      }
    });
  }

  function handleDelete() {
    startDeleteTransition(async () => {
      const result = await deletePost(post.id);
      if (!result.error) onDeleted(post.id);
    });
  }

  function submitReport() {
    setReportError(null);
    if (!reportReason) {
      setReportError(tErrors("reportReasonRequired"));
      return;
    }
    startReportTransition(async () => {
      const result = await reportPost(post.id, reportReason, reportDetail);
      if (!result.ok) {
        setReportError(result.error ?? "");
        return;
      }
      setReportDone(true);
    });
  }

  function goToPost() {
    if (disableCardClick) return;
    router.push(postUrl);
  }

  // カード全体をクリック可能にしつつ、ボタン・リンク・画像など
  // 個別に振る舞いを持つ要素ではナビゲーションを起こさないようにする
  function stop(e: MouseEvent) {
    e.stopPropagation();
  }

  const initials = (post.author.display_name || "?").slice(0, 1).toUpperCase();

  return (
    <div
      ref={cardRef}
      onClick={goToPost}
      className={`rounded-xl border border-border bg-surface p-4 ${
        disableCardClick ? "" : "cursor-pointer transition hover:border-border-strong"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/u/${post.author.handle}`}
          onClick={stop}
          className="flex min-w-0 items-center gap-2.5"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-surface-raised">
            {post.author.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={post.author.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="font-display text-[12px] font-semibold text-accent-ai">
                {initials}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-text-primary">
              {post.author.display_name || t("unnamedUser")}
            </p>
            <p className="truncate font-mono text-[11px] text-text-dim">
              {new Date(post.created_at).toLocaleString(INTL_LOCALE[locale] ?? "ja-JP")}
            </p>
          </div>
        </Link>

        <div className="relative shrink-0" onClick={stop}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={t("moreMenu")}
            className="flex h-7 w-7 items-center justify-center rounded-full text-text-dim transition hover:bg-surface-raised hover:text-text-secondary"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="5" cy="12" r="1.8" />
              <circle cx="12" cy="12" r="1.8" />
              <circle cx="19" cy="12" r="1.8" />
            </svg>
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-8 z-50 w-56 overflow-hidden rounded-xl border border-border bg-bg shadow-lg">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    if (post.isOwn) handleDelete();
                    else setReportOpen(true);
                  }}
                  disabled={isDeletePending}
                  className="block w-full px-4 py-2.5 text-left text-[13px] text-accent-danger transition hover:bg-surface-raised"
                >
                  {post.isOwn ? t("deleteThisPost") : t("reportThisPost")}
                </button>
                <p className="border-t border-border px-4 py-2.5 text-[11px] text-text-dim">
                  {t("moreFeaturesComing")}
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {post.content && (
        <p className="mt-3 whitespace-pre-wrap text-[14px] leading-relaxed text-text-primary">
          {post.content}
        </p>
      )}

      {post.image_urls.length === 1 && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.image_urls[0]}
          alt=""
          onClick={(e) => {
            stop(e);
            setLightboxIndex(0);
          }}
          className="mt-3 max-h-96 w-full cursor-zoom-in rounded-lg border border-border object-cover"
        />
      )}

      {post.image_urls.length > 1 && (
        <div className="mt-3 grid grid-cols-2 gap-1.5">
          {post.image_urls.map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={url}
              src={url}
              alt=""
              onClick={(e) => {
                stop(e);
                setLightboxIndex(i);
              }}
              className="aspect-square w-full cursor-zoom-in rounded-lg border border-border object-cover"
            />
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center gap-5 border-t border-border pt-3">
        <button
          type="button"
          onClick={(e) => {
            stop(e);
            handleLike();
          }}
          disabled={isLikePending}
          className={`flex items-center gap-1.5 text-[13px] transition ${
            liked ? "text-accent-signal" : "text-text-muted hover:text-text-primary"
          }`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill={liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
            <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 1 0-7.8 7.8l1.1 1L12 21l7.7-7.7 1.1-1a5.5 5.5 0 0 0 0-7.8Z" />
          </svg>
          {likeCount}
        </button>
        <button
          type="button"
          onClick={(e) => {
            stop(e);
            if (disableCardClick) handleToggleComments();
            else goToPost();
          }}
          className="flex items-center gap-1.5 text-[13px] text-text-muted transition hover:text-text-primary"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
          {commentCount}
        </button>
        <span className="ml-auto flex items-center gap-1.5 text-[12px] text-text-dim">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          {post.view_count}
        </span>
      </div>

      {/* フォロー中の人によるコメントは、展開しなくてもここにプレビューされる（X風） */}
      {!showComments && post.relevantComment && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-surface-raised px-3 py-2">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-bg">
            {post.relevantComment.author.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={post.relevantComment.author.avatar_url}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="font-display text-[9px] font-semibold text-accent-ai">
                {(post.relevantComment.author.display_name || "?").slice(0, 1).toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-text-dim">
              {t("relevantCommentNote", {
                name: post.relevantComment.author.display_name || t("unnamedUser"),
              })}
            </p>
            <p className="truncate text-[13px] text-text-secondary">
              {post.relevantComment.content}
            </p>
          </div>
        </div>
      )}

      {showComments && (
        <div className="mt-3 space-y-2.5 border-t border-border pt-3" onClick={stop}>
          {comments === null ? (
            <p className="text-[12px] text-text-dim">{t("loadingComments")}</p>
          ) : comments.length === 0 ? (
            <p className="text-[12px] text-text-dim">{t("noComments")}</p>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/u/${c.author.handle}`}
                    className="text-[12px] font-medium text-text-primary hover:underline"
                  >
                    {c.author.display_name || t("unnamedUser")}
                  </Link>
                  <p className="text-[13px] text-text-secondary">{c.content}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteComment(c.id)}
                  className="shrink-0 text-[11px] text-text-dim hover:text-accent-danger"
                >
                  {t("deleteComment")}
                </button>
              </div>
            ))
          )}

          <div className="flex gap-2 pt-1">
            <input
              type="text"
              value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddComment()}
              placeholder={t("commentPlaceholder")}
              maxLength={280}
              className="min-w-0 flex-1 rounded-lg border border-border bg-bg px-3 py-1.5 text-[13px] text-text-primary outline-none placeholder:text-text-dim focus:border-border-strong"
            />
            <button
              type="button"
              onClick={handleAddComment}
              disabled={isCommentPending || !commentDraft.trim()}
              className="shrink-0 rounded-lg bg-accent-signal px-3.5 py-1.5 text-[12px] font-medium text-white transition hover:brightness-105 disabled:opacity-50"
            >
              {t("sendComment")}
            </button>
          </div>
        </div>
      )}

      {reportOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={(e) => {
            stop(e);
            if (!isReportPending) setReportOpen(false);
          }}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-border bg-bg p-5 shadow-xl"
            onClick={stop}
          >
            {reportDone ? (
              <div className="py-4 text-center">
                <p className="mb-1 text-[14px] font-medium text-text-primary">
                  {t("reportDoneTitle")}
                </p>
                <p className="mb-4 text-[13px] text-text-muted">{t("reportDoneBody")}</p>
                <button
                  type="button"
                  onClick={() => setReportOpen(false)}
                  className="rounded-lg border border-border px-4 py-2 text-[13px] text-text-secondary hover:bg-surface"
                >
                  {t("close")}
                </button>
              </div>
            ) : (
              <>
                <h2 className="mb-3 font-display text-[15px] font-semibold text-text-primary">
                  {t("reportModalTitle")}
                </h2>
                <div className="mb-3 space-y-1.5">
                  {REASON_KEYS.map((key) => (
                    <label
                      key={key}
                      className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-[13px] text-text-secondary has-[:checked]:border-accent-signal/40 has-[:checked]:bg-accent-signal-dim has-[:checked]:text-accent-signal"
                    >
                      <input
                        type="radio"
                        name={`post-report-reason-${post.id}`}
                        value={key}
                        checked={reportReason === key}
                        onChange={() => setReportReason(key)}
                        className="h-3.5 w-3.5"
                      />
                      {t(`reportReasons.${key}`)}
                    </label>
                  ))}
                </div>
                <textarea
                  value={reportDetail}
                  onChange={(e) => setReportDetail(e.target.value)}
                  rows={3}
                  placeholder={t("reportDetailPlaceholder")}
                  className="mb-3 w-full resize-none rounded-lg border border-border bg-surface px-3 py-2 text-[13px] text-text-primary outline-none placeholder:text-text-dim"
                />
                {reportError && (
                  <p className="mb-3 text-[12px] text-accent-danger">{reportError}</p>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={submitReport}
                    disabled={isReportPending}
                    className="flex-1 rounded-lg bg-accent-danger px-4 py-2 text-[13px] font-medium text-white transition hover:brightness-105 disabled:opacity-60"
                  >
                    {isReportPending ? t("reportSubmitting") : t("reportSubmit")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setReportOpen(false)}
                    disabled={isReportPending}
                    className="rounded-lg border border-border px-4 py-2 text-[13px] text-text-secondary hover:bg-surface"
                  >
                    {t("cancel")}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4"
          onClick={(e) => {
            stop(e);
            setLightboxIndex(null);
          }}
        >
          <button
            type="button"
            onClick={(e) => {
              stop(e);
              setLightboxIndex(null);
            }}
            aria-label={t("closeLightbox")}
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>

          {post.image_urls.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  stop(e);
                  setLightboxIndex((i) => ((i ?? 0) - 1 + post.image_urls.length) % post.image_urls.length);
                }}
                className="absolute left-2 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:left-4"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  stop(e);
                  setLightboxIndex((i) => ((i ?? 0) + 1) % post.image_urls.length);
                }}
                className="absolute right-2 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:right-4"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            </>
          )}

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.image_urls[lightboxIndex]}
            alt=""
            onClick={stop}
            className="max-h-full max-w-full rounded-lg object-contain"
          />
        </div>
      )}
    </div>
  );
}
