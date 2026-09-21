"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import {
  toggleRequestUpvote,
  linkToolToRequest,
  unlinkToolFromRequest,
  deleteRequest,
  type RequestItem,
} from "@/app/requests/actions";
import { getMyPublishedTools } from "@/app/feed/actions";

const INTL_LOCALE: Record<string, string> = { ja: "ja-JP", zh: "zh-TW", en: "en-US" };

type MyTool = { id: string; name: string; thumbnail_url: string | null };

export default function RequestCard({
  request,
  isLoggedIn,
  onDeleted,
}: {
  request: RequestItem;
  isLoggedIn: boolean;
  onDeleted: (id: string) => void;
}) {
  const t = useTranslations("requests");
  const locale = useLocale();
  const router = useRouter();

  const [upvoted, setUpvoted] = useState(request.upvotedByMe);
  const [upvoteCount, setUpvoteCount] = useState(request.upvoteCount);
  const [isUpvotePending, startUpvoteTransition] = useTransition();

  const [linkedTools, setLinkedTools] = useState(request.linkedTools);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [myTools, setMyTools] = useState<MyTool[] | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [isLinkPending, startLinkTransition] = useTransition();
  const [isDeletePending, startDeleteTransition] = useTransition();

  useEffect(() => {
    if (pickerOpen && myTools === null) {
      getMyPublishedTools().then(setMyTools);
    }
  }, [pickerOpen, myTools]);

  function handleUpvote() {
    if (!isLoggedIn) {
      router.push("/login?next=/requests");
      return;
    }
    const next = !upvoted;
    setUpvoted(next);
    setUpvoteCount((n) => n + (next ? 1 : -1));
    startUpvoteTransition(async () => {
      const result = await toggleRequestUpvote(request.id);
      if (result.error) {
        setUpvoted(!next);
        setUpvoteCount((n) => n - (next ? 1 : -1));
      }
    });
  }

  function handleLink(toolId: string) {
    setLinkError(null);
    startLinkTransition(async () => {
      const result = await linkToolToRequest(request.id, toolId);
      if (result.error) {
        setLinkError(result.error);
        return;
      }
      if (result.item) setLinkedTools((prev) => [...prev, result.item!]);
      setPickerOpen(false);
    });
  }

  function handleUnlink(linkId: string) {
    startLinkTransition(async () => {
      const result = await unlinkToolFromRequest(linkId);
      if (!result.error) {
        setLinkedTools((prev) => prev.filter((lt) => lt.linkId !== linkId));
      }
    });
  }

  function handleDelete() {
    startDeleteTransition(async () => {
      const result = await deleteRequest(request.id);
      if (!result.error) onDeleted(request.id);
    });
  }

  const alreadyLinkedToolIds = new Set(linkedTools.map((lt) => lt.toolId));
  const linkableTools = (myTools ?? []).filter((mt) => !alreadyLinkedToolIds.has(mt.id));

  return (
    <div id={request.id} className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={handleUpvote}
          disabled={isUpvotePending}
          className={`flex shrink-0 flex-col items-center rounded-lg border px-3 py-1.5 transition ${
            upvoted
              ? "border-accent-signal/40 bg-accent-signal-dim text-accent-signal"
              : "border-border text-text-muted hover:border-border-strong hover:text-text-primary"
          }`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill={upvoted ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
          <span className="mt-0.5 text-[12px] font-semibold">{upvoteCount}</span>
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-[14px] font-semibold text-text-primary">{request.title}</h3>
            {request.isOwn && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeletePending}
                className="shrink-0 text-[12px] text-text-dim transition hover:text-accent-danger"
              >
                {t("deleteRequest")}
              </button>
            )}
          </div>
          <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-text-secondary">
            {request.description}
          </p>
          <p className="mt-2 font-mono text-[11px] text-text-dim">
            {request.requester.display_name || t("unnamedUser")} ・{" "}
            {new Date(request.createdAt).toLocaleDateString(INTL_LOCALE[locale] ?? "ja-JP")}
          </p>

          {linkedTools.length > 0 && (
            <div className="mt-3 space-y-1.5 border-t border-border pt-3">
              <p className="text-[11px] font-medium text-text-muted">{t("linkedToolsLabel")}</p>
              {linkedTools.map((lt) => (
                <div
                  key={lt.linkId}
                  className="flex items-center gap-2 rounded-lg bg-surface-raised px-2.5 py-1.5"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-md bg-gradient-to-br from-surface to-bg">
                    {lt.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={lt.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="font-display text-[10px] font-semibold text-accent-ai">
                        {lt.name.slice(0, 1)}
                      </span>
                    )}
                  </div>
                  <Link
                    href={`/apps/${lt.slug}`}
                    className="min-w-0 flex-1 truncate text-[13px] font-medium text-text-primary hover:underline"
                  >
                    {lt.name}
                  </Link>
                  {lt.linkedByMe && (
                    <button
                      type="button"
                      onClick={() => handleUnlink(lt.linkId)}
                      className="shrink-0 text-[11px] text-text-dim hover:text-accent-danger"
                    >
                      {t("unlink")}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="mt-3 border-t border-border pt-3">
            {pickerOpen ? (
              <div>
                {myTools === null ? (
                  <p className="text-[12px] text-text-dim">...</p>
                ) : linkableTools.length === 0 ? (
                  <p className="text-[12px] text-text-dim">{t("noToolsToLink")}</p>
                ) : (
                  <div className="max-h-40 space-y-0.5 overflow-y-auto">
                    {linkableTools.map((mt) => (
                      <button
                        key={mt.id}
                        type="button"
                        onClick={() => handleLink(mt.id)}
                        disabled={isLinkPending}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] text-text-primary transition hover:bg-surface-raised"
                      >
                        <span className="min-w-0 flex-1 truncate">{mt.name}</span>
                      </button>
                    ))}
                  </div>
                )}
                {linkError && <p className="mt-1 text-[12px] text-accent-danger">{linkError}</p>}
                <button
                  type="button"
                  onClick={() => setPickerOpen(false)}
                  className="mt-1.5 text-[12px] text-text-muted hover:text-text-primary"
                >
                  {t("cancel")}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (!isLoggedIn) {
                    router.push("/login?next=/requests");
                    return;
                  }
                  setPickerOpen(true);
                }}
                className="text-[12px] font-medium text-accent-signal hover:underline"
              >
                {t("linkTool")}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
