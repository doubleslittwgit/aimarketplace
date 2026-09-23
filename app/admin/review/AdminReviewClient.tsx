"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { formatPrice } from "@/lib/mock-data";
import { HIGH_PRICE_REVIEW_THRESHOLD } from "@/lib/ai/review-tool";
import { approveTool, rejectTool, unpublishToolByAdmin } from "./actions";

type PendingTool = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  category: string;
  price: number;
  runtime: "cloud" | "local";
  platforms: string[] | null;
  min_os_version: string | null;
  demo_url: string | null;
  thumbnail_url: string | null;
  file_key: string | null;
  ai_review_summary: string | null;
  ai_review_risk: "low" | "medium" | "high" | "unknown" | null;
  created_at: string;
  author_id: string;
  profiles: { display_name: string | null; handle: string } | null;
};

type PublishedTool = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  price: number;
  category: string;
  runtime: "cloud" | "local";
  created_at: string;
  author_id: string;
  profiles: { display_name: string | null; handle: string } | null;
};

const RISK_STYLE: Record<string, string> = {
  low: "bg-accent-success/10 text-accent-success",
  medium: "bg-accent-ai-dim text-accent-ai",
  high: "bg-accent-danger/10 text-accent-danger",
  unknown: "bg-surface-raised text-text-muted",
};

export default function AdminReviewClient({
  tools,
  publishedTools,
}: {
  tools: PendingTool[];
  publishedTools: PublishedTool[];
}) {
  const t = useTranslations("admin");
  const [tab, setTab] = useState<"pending" | "published">("pending");

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Link
          href="/admin"
          className="mb-3 inline-flex items-center gap-1 text-[12px] text-text-muted transition hover:text-text-primary"
        >
          ← 管理ダッシュボード
        </Link>
        <h1 className="mb-1 font-display text-2xl font-semibold text-text-primary">
          {t("reviewTitle")}
        </h1>
        <p className="mb-6 text-[13px] text-text-muted">
          {t("reviewSubtitle")}
        </p>

        <div className="mb-6 flex gap-1 border-b border-border">
          <TabButton
            active={tab === "pending"}
            onClick={() => setTab("pending")}
            label={t("pendingTab", { count: tools.length })}
          />
          <TabButton
            active={tab === "published"}
            onClick={() => setTab("published")}
            label={t("publishedTab", { count: publishedTools.length })}
          />
        </div>

        {tab === "pending" ? (
          tools.length === 0 ? (
            <div className="rounded-xl border border-border bg-surface p-8 text-center text-[13px] text-text-muted">
              {t("noPending")}
            </div>
          ) : (
            <div className="space-y-5">
              {tools.map((tool) => (
                <ReviewCard key={tool.id} tool={tool} />
              ))}
            </div>
          )
        ) : publishedTools.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface p-8 text-center text-[13px] text-text-muted">
            {t("noPublished")}
          </div>
        ) : (
          <div className="space-y-3">
            {publishedTools.map((tool) => (
              <PublishedToolRow key={tool.id} tool={tool} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px border-b-2 px-3 py-2.5 text-[13px] font-medium transition ${
        active
          ? "border-accent-signal text-text-primary"
          : "border-transparent text-text-muted hover:text-text-secondary"
      }`}
    >
      {label}
    </button>
  );
}

function PublishedToolRow({ tool }: { tool: PublishedTool }) {
  const t = useTranslations("admin");
  const tCommon = useTranslations("common");
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function handleUnpublish() {
    setError(null);
    startTransition(async () => {
      const result = await unpublishToolByAdmin(tool.id, reason);
      if (result?.error) setError(result.error);
      else setDone(true);
    });
  }

  if (done) {
    return (
      <div className="rounded-xl border border-border bg-surface p-4 text-[13px] text-text-muted">
        {t("unpublishedNotice", { name: tool.name })}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate font-display text-[14px] font-semibold text-text-primary">
            {tool.name}
          </h2>
          <p className="mt-0.5 text-[12px] text-text-muted">{tool.tagline}</p>
          <p className="mt-0.5 font-mono text-[11px] text-text-dim">
            {t("seller", { name: tool.profiles?.display_name ?? t("unknown") })}
            （@{tool.profiles?.handle}） ・{" "}
            {formatPrice(tool.price)} ・ {tool.category}
          </p>
        </div>
        <a
          href={`/apps/${tool.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-[12px] text-text-muted hover:underline"
        >
          {t("viewPage")}
        </a>
      </div>

      {error && (
        <div className="mt-3 rounded-lg border border-accent-danger/30 bg-accent-danger/5 px-3 py-2 text-[12px] text-accent-danger">
          {error}
        </div>
      )}

      {showForm ? (
        <div className="mt-3">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder={t("unpublishReasonPlaceholder")}
            className="mb-2 w-full resize-none rounded-lg border border-border bg-bg px-3 py-2 text-[12px] text-text-primary outline-none focus:border-border-strong"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleUnpublish}
              disabled={isPending}
              className="rounded-lg bg-accent-danger px-4 py-2 text-[12px] font-medium text-white transition hover:brightness-105 disabled:opacity-60"
            >
              {isPending ? tCommon("processing") : t("unpublishConfirm")}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-border px-4 py-2 text-[12px] text-text-secondary hover:bg-surface-raised"
            >
              {t("cancel")}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="rounded-lg border border-accent-danger/40 bg-bg px-4 py-2 text-[12px] font-medium text-accent-danger transition hover:bg-accent-danger/10"
          >
            {t("unpublish")}
          </button>
        </div>
      )}
    </div>
  );
}

function ReviewCard({ tool }: { tool: PendingTool }) {
  const t = useTranslations("admin");
  const tCommon = useTranslations("common");
  const [isApproving, startApprove] = useTransition();
  const [isRejecting, startReject] = useTransition();
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [reason, setReason] = useState(tool.ai_review_summary ?? "");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<"approved" | "rejected" | null>(null);

  function handleApprove() {
    setError(null);
    startApprove(async () => {
      const result = await approveTool(tool.id);
      if (result?.error) setError(result.error);
      else setDone("approved");
    });
  }

  function handleReject() {
    setError(null);
    startReject(async () => {
      const result = await rejectTool(tool.id, reason);
      if (result?.error) setError(result.error);
      else setDone("rejected");
    });
  }

  if (done) {
    return (
      <div className="rounded-xl border border-border bg-surface p-5 text-[13px] text-text-muted">
        {done === "approved"
          ? t("approvedNotice", { name: tool.name })
          : t("rejectedNotice", { name: tool.name })}
      </div>
    );
  }

  const risk = tool.ai_review_risk ?? "unknown";
  const riskLabel = {
    low: t("riskLow"),
    medium: t("riskMedium"),
    high: t("riskHigh"),
    unknown: t("riskUnknown"),
  }[risk];

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate font-display text-[16px] font-semibold text-text-primary">
              {tool.name}
            </h2>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] ${RISK_STYLE[risk]}`}
            >
              {riskLabel}
            </span>
            {tool.price >= HIGH_PRICE_REVIEW_THRESHOLD && (
              <span className="shrink-0 rounded-full bg-accent-signal-dim px-2 py-0.5 font-mono text-[10px] text-accent-signal">
                {t("highPriceFlag")}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[12px] text-text-muted">{tool.tagline}</p>
          <p className="mt-0.5 font-mono text-[11px] text-text-dim">
            {t("seller", { name: tool.profiles?.display_name ?? t("unknown") })}
            （@{tool.profiles?.handle}） ・{" "}
            {formatPrice(tool.price)} ・ {tool.category} ・{" "}
            {tool.runtime === "local" ? t("runtimeLocal") : t("runtimeCloud")}
          </p>
        </div>
        {tool.thumbnail_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={tool.thumbnail_url}
            alt=""
            className="h-14 w-14 shrink-0 rounded-lg border border-border object-cover"
          />
        )}
      </div>

      <p className="mb-3 whitespace-pre-wrap text-[13px] leading-relaxed text-text-secondary">
        {tool.description}
      </p>

      {tool.ai_review_summary && (
        <div className="mb-3 rounded-lg border border-border bg-bg p-3">
          <p className="mb-1 text-[11px] font-medium text-text-muted">{t("aiReviewSummary")}</p>
          <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-text-secondary">
            {tool.ai_review_summary}
          </p>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-3 text-[12px]">
        {tool.runtime === "local" && tool.file_key && (
          <a
            href={`/apps/download/${tool.id}`}
            className="text-accent-signal hover:underline"
          >
            {t("downloadToCheck")}
          </a>
        )}
        {tool.runtime === "cloud" && tool.demo_url && (
          <a
            href={tool.demo_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-signal hover:underline"
          >
            {t("openDemoUrl")}
          </a>
        )}
        <a
          href={`/apps/${tool.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-text-muted hover:underline"
        >
          {t("previewPage")}
        </a>
      </div>

      {error && (
        <div className="mb-3 rounded-lg border border-accent-danger/30 bg-accent-danger/5 px-3 py-2 text-[12px] text-accent-danger">
          {error}
        </div>
      )}

      {showRejectForm ? (
        <div>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder={t("rejectReasonPlaceholder")}
            className="mb-2 w-full resize-none rounded-lg border border-border bg-bg px-3 py-2 text-[12px] text-text-primary outline-none focus:border-border-strong"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleReject}
              disabled={isRejecting}
              className="rounded-lg bg-accent-danger px-4 py-2 text-[12px] font-medium text-white transition hover:brightness-105 disabled:opacity-60"
            >
              {isRejecting ? tCommon("processing") : t("rejectConfirm")}
            </button>
            <button
              type="button"
              onClick={() => setShowRejectForm(false)}
              className="rounded-lg border border-border px-4 py-2 text-[12px] text-text-secondary hover:bg-surface-raised"
            >
              {t("cancel")}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleApprove}
            disabled={isApproving}
            className="rounded-lg bg-accent-success px-4 py-2 text-[12px] font-medium text-white transition hover:brightness-105 disabled:opacity-60"
          >
            {isApproving ? tCommon("processing") : t("approve")}
          </button>
          <button
            type="button"
            onClick={() => setShowRejectForm(true)}
            className="rounded-lg border border-accent-danger/40 bg-bg px-4 py-2 text-[12px] font-medium text-accent-danger transition hover:bg-accent-danger/10"
          >
            {t("reject")}
          </button>
        </div>
      )}
    </div>
  );
}
