"use client";

import { useState, useTransition } from "react";
import { useTranslations, useLocale } from "next-intl";
import { updateReportStatus } from "./actions";
import type { ReportRow } from "./page";

const STATUS_STYLE: Record<string, string> = {
  open: "bg-accent-danger/10 text-accent-danger",
  reviewed: "bg-accent-success/10 text-accent-success",
  dismissed: "bg-surface-raised text-text-muted",
};

const INTL_LOCALE: Record<string, string> = { ja: "ja-JP", zh: "zh-TW", en: "en-US" };

export default function ReportsClient({ reports }: { reports: ReportRow[] }) {
  const t = useTranslations("admin");
  const [items, setItems] = useState(reports);
  const [tab, setTab] = useState<"open" | "all">("open");

  const visible = tab === "open" ? items.filter((r) => r.status === "open") : items;

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="mb-1 font-display text-2xl font-semibold text-text-primary">
          {t("reportsTitle")}
        </h1>
        <p className="mb-6 text-[13px] text-text-muted">
          {t("reportsSubtitle")}
        </p>

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
              <ReportRowItem key={r.id} report={r} onUpdate={(next) => {
                setItems((prev) => prev.map((p) => (p.id === r.id ? { ...p, status: next } : p)));
              }} />
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
}: {
  report: ReportRow;
  onUpdate: (status: "reviewed" | "dismissed") => void;
}) {
  const t = useTranslations("admin");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();

  const REASON_LABELS: Record<string, string> = {
    malware: t("reasonMalware"),
    misrepresentation: t("reasonMisrepresentation"),
    copyright: t("reasonCopyright"),
    spam: t("reasonSpam"),
    other: t("reasonOther"),
  };
  const STATUS_LABEL: Record<string, string> = {
    open: t("statusOpen"),
    reviewed: t("statusReviewed"),
    dismissed: t("statusDismissed"),
  };

  function handle(status: "reviewed" | "dismissed") {
    startTransition(async () => {
      const result = await updateReportStatus(report.id, status);
      if (!result.error) onUpdate(status);
    });
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <a
              href={report.tools ? `/apps/${report.tools.slug}` : "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate font-display text-[14px] font-semibold text-text-primary hover:underline"
            >
              {report.tools?.name ?? t("deletedTool")}
            </a>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] ${STATUS_STYLE[report.status]}`}>
              {STATUS_LABEL[report.status]}
            </span>
          </div>
          <p className="mt-1 text-[13px] text-text-secondary">
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
        <div className="mt-3 flex gap-2">
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
        </div>
      )}
    </div>
  );
}
