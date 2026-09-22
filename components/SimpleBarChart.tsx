"use client";

/**
 * 依存ライブラリを増やしたくなかったので、SVGで直接描く軽量な棒グラフ。
 * 「簡単な分析ダッシュボード」程度の用途を想定しており、
 * 高機能なグラフライブラリを入れるほどの必要は無いと判断した。
 *
 * 【表示用の文字列を、呼び出し側で作ってから渡す理由】
 * 以前は formatValue という「関数」を受け取る作りだったが、この部品は
 * クライアント側（"use client"）で動くのに対し、呼び出し元の分析ページは
 * サーバー側で動く。Next.jsでは、サーバーからクライアントへ関数を
 * 渡すことができない（ネットワーク越しに送れないため）ので、実行時に
 * エラーとなりページ全体が開けなくなっていた。
 * 型チェックやビルドでは検出できない種類の問題だったため、
 * 「整形済みの文字列」をデータに含めて渡す形に変更している。
 */
export default function SimpleBarChart({
  data,
}: {
  data: { label: string; value: number; displayValue: string }[];
}) {
  const max = Math.max(1, ...data.map((d) => d.value));

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
              {d.label}: {d.displayValue}
            </div>
          </div>
        );
      })}
    </div>
  );
}
