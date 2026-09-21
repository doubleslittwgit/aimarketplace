"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import RequestCard from "@/components/RequestCard";
import { fetchRequests, createRequest, type RequestItem } from "@/app/requests/actions";

type Sort = "top" | "new";

export default function RequestBoard({
  initialRequests,
  initialHasMore,
  isLoggedIn,
}: {
  initialRequests: RequestItem[];
  initialHasMore: boolean;
  isLoggedIn: boolean;
}) {
  const t = useTranslations("requests");
  const router = useRouter();
  const [sort, setSort] = useState<Sort>("top");
  const [requests, setRequests] = useState(initialRequests);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isPending, startTransition] = useTransition();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [composerError, setComposerError] = useState<string | null>(null);
  const [isPosting, startPosting] = useTransition();

  function switchSort(next: Sort) {
    if (next === sort) return;
    setSort(next);
    startTransition(async () => {
      const result = await fetchRequests({ sort: next });
      setRequests(result.requests);
      setHasMore(result.hasMore);
    });
  }

  function handleLoadMore() {
    const last = requests[requests.length - 1];
    if (!last) return;
    startTransition(async () => {
      const result = await fetchRequests({
        sort,
        before: { createdAt: last.createdAt, upvoteCount: last.upvoteCount },
      });
      setRequests((prev) => [...prev, ...result.requests]);
      setHasMore(result.hasMore);
    });
  }

  function handleSubmit() {
    if (!isLoggedIn) {
      router.push("/login?next=/requests");
      return;
    }
    setComposerError(null);
    startPosting(async () => {
      const result = await createRequest(title, description);
      if (result.error) {
        setComposerError(result.error);
        return;
      }
      if (result.item) setRequests((prev) => [result.item!, ...prev]);
      setTitle("");
      setDescription("");
    });
  }

  function handleDeleted(id: string) {
    setRequests((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <div>
      <div className="mb-6 rounded-xl border border-border bg-surface p-4">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("titlePlaceholder")}
          maxLength={120}
          className="w-full border-none bg-transparent text-[14px] font-medium text-text-primary outline-none placeholder:text-text-dim"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t("descriptionPlaceholder")}
          rows={2}
          maxLength={600}
          className="mt-1.5 w-full resize-none border-none bg-transparent text-[13px] text-text-secondary outline-none placeholder:text-text-dim"
        />
        {composerError && <p className="mt-1 text-[12px] text-accent-danger">{composerError}</p>}
        {!isLoggedIn && <p className="mt-1 text-[12px] text-text-dim">{t("loginPrompt")}</p>}
        <div className="mt-3 flex justify-end border-t border-border pt-3">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPosting || !title.trim() || !description.trim()}
            className="rounded-full bg-accent-signal px-5 py-1.5 text-[13px] font-medium text-white transition hover:brightness-105 disabled:opacity-50"
          >
            {isPosting ? t("submitting") : t("submitButton")}
          </button>
        </div>
      </div>

      <div className="mb-5 flex gap-1 border-b border-border">
        <TabButton active={sort === "top"} onClick={() => switchSort("top")} label={t("tabTop")} />
        <TabButton active={sort === "new"} onClick={() => switchSort("new")} label={t("tabNew")} />
      </div>

      {requests.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <p className="text-[13px] text-text-muted">{t("empty")}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((r) => (
            <RequestCard key={r.id} request={r} isLoggedIn={isLoggedIn} onDeleted={handleDeleted} />
          ))}
        </div>
      )}

      {hasMore && (
        <button
          type="button"
          onClick={handleLoadMore}
          disabled={isPending}
          className="mt-5 w-full rounded-lg border border-border py-2.5 text-[13px] text-text-secondary transition hover:bg-surface disabled:opacity-60"
        >
          {isPending ? t("loadingMore") : t("loadMore")}
        </button>
      )}
    </div>
  );
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px border-b-2 px-4 py-2.5 text-[13px] font-medium transition ${
        active
          ? "border-accent-signal text-accent-signal"
          : "border-transparent text-text-muted hover:text-text-primary"
      }`}
    >
      {label}
    </button>
  );
}
