"use client";

import { useEffect, useRef } from "react";

/**
 * 依存ライブラリを増やさずに描く、日別・月別推移用の棒グラフ。
 *
 * 【表示用の文字列を、呼び出し側で作ってから渡す理由】
 * この部品はクライアント側（"use client"）で動くのに対し、呼び出し元の
 * 分析ページはサーバー側で動く。Next.jsではサーバーからクライアントへ
 * 関数を渡せない（ネットワーク越しに送れないため）ので、整形関数ではなく
 * 「整形済みの文字列」をデータに含めて受け取る。
 *
 * 【横スクロールにしている理由】
 * 画面幅に30本を押し込むと、1本あたり数ピクセルしか無く、日付ラベルは
 * 間引くしかなかった。だが「何日にいくら売れたか」を細かく見たい場面では、
 * 間引かれると役に立たない。そこで棒1本あたりの幅を固定し、収まらない分は
 * 横スクロールで見る方式にしている。
 * スマホは指でスワイプ、PCはスクロールバーで操作でき、別々に作り分ける
 * 必要が無い。
 *
 * 縦軸のラベルは、スクロールしても常に見えるようスクロール領域の外に置く。
 */
export default function SimpleBarChart({
  data,
}: {
  data: { label: string; value: number; displayValue: string }[];
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // 初期表示では右端（＝最新）を見せる。
  // 売上の確認で真っ先に見たいのは直近の数日なので、左端の
  // 「30日前」から始まると毎回スクロールする手間が生じるため。
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [data.length]);

  const max = Math.max(1, ...data.map((d) => d.value));
  // 目盛りは上端・中間・0の3本。細かすぎると狭い画面で読みにくいため。
  const gridLines = [1, 0.5, 0];
  // 棒1本あたりの最小幅。日付ラベル（例: 12/31）が折り返さず収まる幅にしている。
  const MIN_BAR_WIDTH = 34;

  function formatAxis(n: number): string {
    if (n >= 10000) return `¥${Math.round(n / 1000)}k`;
    return `¥${n.toLocaleString()}`;
  }

  return (
    <div className="flex gap-3">
      {/* 縦軸（金額）。スクロールしても常に見えるよう、スクロール領域の外に置く */}
      <div className="relative h-40 w-10 shrink-0">
        {gridLines.map((ratio) => (
          <span
            key={ratio}
            className="absolute right-0 -translate-y-1/2 font-mono text-[10px] text-text-dim"
            style={{ top: `${(1 - ratio) * 100}%` }}
          >
            {formatAxis(Math.round(max * ratio))}
          </span>
        ))}
      </div>

      <div ref={scrollRef} className="min-w-0 flex-1 overflow-x-auto pb-1">
        <div style={{ minWidth: `${data.length * MIN_BAR_WIDTH}px` }}>
          {/* 棒と補助線 */}
          <div className="relative h-40">
            {gridLines.map((ratio) => (
              <div
                key={ratio}
                className={`absolute inset-x-0 border-t ${
                  ratio === 0 ? "border-border-strong" : "border-border"
                }`}
                style={{ top: `${(1 - ratio) * 100}%` }}
              />
            ))}

            <div className="relative flex h-full items-end gap-[3px]">
              {data.map((d, i) => {
                const heightPercent = (d.value / max) * 100;
                return (
                  <div key={i} className="group relative h-full flex-1">
                    <div className="flex h-full flex-col justify-end">
                      {d.value > 0 ? (
                        <div
                          className="w-full rounded-t-sm bg-accent-signal/70 transition group-hover:bg-accent-signal"
                          style={{ height: `${Math.max(heightPercent, 2)}%` }}
                        />
                      ) : (
                        // 売上0の日も、薄い土台を置いて「その日が存在する」ことを示す
                        <div className="h-[2px] w-full rounded-sm bg-border" />
                      )}
                    </div>
                    <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-text-primary px-2 py-1 text-[11px] text-bg opacity-0 shadow-sm transition group-hover:opacity-100">
                      {d.label}: {d.displayValue}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 横軸。1本あたりの幅を確保しているので、全ての日付・月を表示できる */}
          <div className="mt-1.5 flex h-4 gap-[3px]">
            {data.map((d, i) => (
              <div key={i} className="relative flex-1">
                <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap font-mono text-[10px] text-text-dim">
                  {d.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
