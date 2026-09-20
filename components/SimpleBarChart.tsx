"use client";

/**
 * 依存ライブラリを増やしたくなかったので、SVGで直接描く軽量な棒グラフ。
 * 「簡単な分析ダッシュボード」程度の用途を想定しており、
 * 高機能なグラフライブラリを入れるほどの必要は無いと判断した。
 */
export default function SimpleBarChart({
  data,
  formatValue,
}: {
  data: { label: string; value: number }[];
  formatValue?: (n: number) => string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const fmt = formatValue ?? ((n: number) => String(n));

  return (
    <div className="flex h-40 items-end gap-[3px]">
      {data.map((d, i) => {
        const heightPercent = (d.value / max) * 100;
        return (
          <div
            key={i}
            className="group relative flex-1"
            style={{ height: "100%" }}
          >
            <div className="flex h-full flex-col justify-end">
              <div
                className="w-full rounded-t-sm bg-accent-signal/70 transition group-hover:bg-accent-signal"
                style={{ height: `${Math.max(heightPercent, d.value > 0 ? 2 : 0)}%` }}
              />
            </div>
            <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-text-primary px-2 py-1 text-[11px] text-bg opacity-0 shadow-sm transition group-hover:opacity-100">
              {d.label}: {fmt(d.value)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
