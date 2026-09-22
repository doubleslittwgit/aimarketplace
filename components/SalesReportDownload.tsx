"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

export default function SalesReportDownload({ currentYear }: { currentYear: number }) {
  const t = useTranslations("analytics");
  // 直近5年分から選べるようにする（確定申告等で前年分が必要になることが多いため）
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
  const [year, setYear] = useState(currentYear);

  return (
    <div className="mb-8 flex flex-wrap items-center gap-2.5 rounded-xl border border-border bg-surface px-4 py-3.5">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-text-muted">
        <path d="M14 3v4a1 1 0 0 0 1 1h4" />
        <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2Z" />
        <path d="M12 17v-6m0 6-2.5-2.5M12 17l2.5-2.5" />
      </svg>
      <span className="text-[13px] text-text-secondary">{t("salesReportLabel")}</span>
      <select
        value={year}
        onChange={(e) => setYear(Number(e.target.value))}
        className="rounded-lg border border-border bg-bg px-2.5 py-1.5 text-[13px] text-text-primary outline-none focus:border-border-strong"
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {t("yearOption", { year: y })}
          </option>
        ))}
      </select>
      <a
        href={`/api/sales-report?year=${year}`}
        className="ml-auto rounded-lg border border-border px-3.5 py-1.5 text-[13px] font-medium text-text-secondary transition hover:bg-surface-raised"
      >
        {t("downloadCsv")}
      </a>
    </div>
  );
}
