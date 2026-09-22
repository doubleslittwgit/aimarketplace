"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import SimpleBarChart from "@/components/SimpleBarChart";

export type ChartPoint = { label: string; value: number; displayValue: string };

type Range = "daily" | "monthly" | "yearly";

/**
 * 売上グラフ。日別・月別・年別を、グラフ左上のタブで切り替える。
 *
 * 以前は「日別」と「月別」で別々のセクションに分かれていたが、
 * 同じ種類の情報が2つ並ぶだけで場所を取り、比べにくかった。
 * 1つのグラフをタブで切り替える形に統合している。
 *
 * 3種類のデータはサーバー側で作って渡す（クライアントで集計すると、
 * 全期間の購入データをブラウザまで送る必要が出てしまうため）。
 */
export default function EarningsChart({
  daily,
  monthly,
  yearly,
  totals,
}: {
  daily: ChartPoint[];
  monthly: ChartPoint[];
  yearly: ChartPoint[];
  /** タブごとの合計表示（期間が違うので、それぞれ別に渡す） */
  totals: Record<Range, string>;
}) {
  const t = useTranslations("analytics");
  const [range, setRange] = useState<Range>("daily");

  const data = range === "daily" ? daily : range === "monthly" ? monthly : yearly;

  const TABS: { key: Range; label: string }[] = [
    { key: "daily", label: t("rangeDaily") },
    { key: "monthly", label: t("rangeMonthly") },
    { key: "yearly", label: t("rangeYearly") },
  ];

  return (
    <section className="mb-8 rounded-xl border border-border bg-surface p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg border border-border bg-bg p-0.5">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setRange(tab.key)}
              className={`rounded-md px-3 py-1.5 text-[12px] font-medium transition ${
                range === tab.key
                  ? "bg-surface-raised text-text-primary shadow-sm"
                  : "text-text-muted hover:text-text-secondary"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <span className="font-display text-[15px] font-semibold text-text-primary">
          {totals[range]}
        </span>
      </div>

      {data.every((d) => d.value === 0) ? (
        <p className="py-8 text-center text-[13px] text-text-muted">{t("noEarningsYet")}</p>
      ) : (
        <SimpleBarChart data={data} />
      )}
    </section>
  );
}
