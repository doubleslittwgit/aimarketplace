"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { updatePostReportStatus, deleteReportedPost } from "./actions";
import type { PostReportRow } from "./page";

const STATUS_STYLE: Record<string, string> = {
  open: "bg-accent-danger/10 text-accent-danger",
  reviewed: "bg-accent-success/10 text-accent-success",
  dismissed: "bg-surface-raised text-text-muted",
};

const INTL_LOCALE: Record<string, string> = { ja: "ja-JP", zh: "zh-TW", en: "en-US" };

export default function PostReportsClient({ reports }: { reports: PostReportRow[] }) {
  const t = useTranslations("admin");
  const [items, setItems] = useState(reports);
  const [tab, setTab] = useState<"open" | "all">("open");

  const visible = tab === "open" ? items.filter((r) => r.status === "open") : items;

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="mb-1 font-display text-2xl font-semibold text-text-primary">
          {t("postReportsTitle")}
        </h1>
        <p className="mb-6 text-[13px] text-text-muted">{t("postReportsSubtitle")}</p>

        <div className="mb-6 flex gap-1 border-b border-border">
          <TabButton
            active={tab === "open"}
            onClick={() => setTab("open")}
            label={t("openTab", { count: items.filter((r) => r.status === "open").length })}
          />
          <TabButton
            active={tab === "all"}
            onClick={() => setTab("all")}
            label={t("allTab", { count: items.length })}
          />
        </div>

        {visible.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface p-8 text-center text-[13px] text-text-muted">
            {tab === "open" ? t("noOpenReports") : t("noReports")}
          </div>
        ) : (
          <div className="space-y-3">
            {visible.map((r) => (
              <ReportRowItem
                key={r.id}
                report={r}
                onUpdate={(next) => {
                  setItems((prev) => prev.map((p) => (p.id === r.id ? { ...p, status: next } : p)));
                }}
                onPostDeleted={() => {
                  setItems((prev) =>
                    prev.map((p) =>
                      p.post_id === r.post_id && p.status === "open"
                        ? { ...p, status: "reviewed", posts: null }
                        : p
                    )
                  );
                }}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
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

function ReportRowItem({
  report,
  onUpdate,
  onPostDeleted,
}: {
  report: PostReportRow;
  onUpdate: (status: "reviewed" | "dismissed") => void;
  onPostDeleted: () => void;
}) {
  const t = useTranslations("admin");
  const tFeed = useTranslations("feed");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();
  const [isDeletePending, startDeleteTransition] = useTransition();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const REASON_LABELS: Record<string, string> = {
    spam: tFeed("reportReasons.spam"),
    harassment: tFeed("reportReasons.harassment"),
    illegal: tFeed("reportReasons.illegal"),
    other: tFeed("reportReasons.other"),
  };
  const STATUS_LABEL: Record<string, string> = {
    open: t("statusOpen"),
    reviewed: t("statusReviewed"),
    dismissed: t("statusDismissed"),
  };

  function handle(status: "reviewed" | "dismissed") {
    startTransition(async () => {
      const result = await updatePostReportStatus(report.id, status);
      if (!result.error) onUpdate(status);
    });
  }

  function handleDeletePost() {
    startDeleteTransition(async () => {
      const result = await deleteReportedPost(report.post_id);
      if (!result.error) onPostDeleted();
    });
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {report.posts ? (
              <Link
                href={`/feed/${report.post_id}`}
                target="_blank"
                className="text-[12px] font-medium text-accent-signal hover:underline"
              >
                {t("viewPost")}
              </Link>
            ) : (
              <span className="text-[12px] text-text-dim">{t("deletedPost")}</span>
            )}
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] ${STATUS_STYLE[report.status]}`}>
              {STATUS_LABEL[report.status]}
            </span>
          </div>
          {report.posts && (
            <p className="mt-1.5 line-clamp-3 whitespace-pre-wrap rounded-lg bg-bg px-3 py-2 text-[13px] text-text-secondary">
              {report.posts.content || t("imageOnlyPost")}
            </p>
          )}
          <p className="mt-1.5 text-[13px] text-text-secondary">
            {REASON_LABELS[report.reason] ?? report.reason}
          </p>
          {report.detail && (
            <p className="mt-1 text-[12px] leading-relaxed text-text-muted">{report.detail}</p>
          )}
          <p className="mt-1.5 font-mono text-[11px] text-text-dim">
            {t("reporter", { name: report.reporter?.display_name ?? report.reporter?.handle ?? t("unknown") })} ・{" "}
            {new Date(report.created_at).toLocaleString(INTL_LOCALE[locale] ?? "ja-JP")}
          </p>
        </div>
      </div>

      {report.status === "open" && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => handle("reviewed")}
            disabled={isPending}
            className="rounded-lg bg-accent-signal px-3 py-1.5 text-[12px] font-medium text-white transition hover:brightness-105 disabled:opacity-60"
          >
            {isPending ? tCommon("processing") : t("markReviewed")}
          </button>
          <button
            type="button"
            onClick={() => handle("dismissed")}
            disabled={isPending}
            className="rounded-lg border border-border px-3 py-1.5 text-[12px] text-text-secondary hover:bg-surface-raised disabled:opacity-60"
          >
            {t("dismiss")}
          </button>
          {report.posts && (
            confirmingDelete ? (
              <>
                <button
                  type="button"
                  onClick={handleDeletePost}
                  disabled={isDeletePending}
                  className="rounded-lg bg-accent-danger px-3 py-1.5 text-[12px] font-medium text-white transition hover:brightness-105 disabled:opacity-60"
                >
                  {isDeletePending ? tCommon("processing") : t("deletePostAction")}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  className="rounded-lg border border-border px-3 py-1.5 text-[12px] text-text-secondary hover:bg-surface-raised"
                >
                  {tFeed("cancel")}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="rounded-lg border border-accent-danger/40 px-3 py-1.5 text-[12px] font-medium text-accent-danger transition hover:bg-accent-danger/10"
              >
                {t("deletePostAction")}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}
