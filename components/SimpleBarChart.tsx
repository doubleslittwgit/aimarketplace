"use client";

/**
 * 依存ライブラリを増やさずに描く、日別推移用の棒グラフ。
 *
 * 【表示用の文字列を、呼び出し側で作ってから渡す理由】
 * この部品はクライアント側（"use client"）で動くのに対し、呼び出し元の
 * 分析ページはサーバー側で動く。Next.jsではサーバーからクライアントへ
 * 関数を渡せない（ネットワーク越しに送れないため）ので、整形関数ではなく
 * 「整形済みの文字列」をデータに含めて受け取る。
 *
 * 【目盛り・軸を持たせている理由】
 * 当初は棒を並べるだけの作りだったが、売上が1日しか無いと「1本だけ
 * ぽつんと立っている」状態になり、金額の大きさも日付も読み取れなかった。
 * 横軸の日付・縦軸の金額・補助線を入れ、売上0の日にも薄い土台を置くことで、
 * 「30日分を見ている」ことが一目で分かるようにしている。
 */
export default function SimpleBarChart({
  data,
}: {
  data: { label: string; value: number; displayValue: string }[];
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  // 目盛りは上端・中間・0の3本。細かすぎると狭い画面で読みにくいため。
  const gridLines = [1, 0.5, 0];

  function formatAxis(n: number): string {
    if (n >= 10000) return `¥${Math.round(n / 1000)}k`;
    return `¥${n.toLocaleString()}`;
  }

  // 横軸のラベルは、全部出すと潰れるので等間隔で数本だけ出す。
  // スマホの横幅では4〜5本が限界なので、それを基準にする。
  const labelStep = Math.max(1, Math.ceil(data.length / 5));

  return (
    <div className="flex gap-3">
      {/* 縦軸（金額） */}
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

      <div className="min-w-0 flex-1">
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

        {/* 横軸（日付）。
            1本分の幅は数文字ぶんしかないため、ラベルをその幅に収めようとすると
            「10月」が「10」「月」に折り返されてしまう。折り返しを禁止した上で、
            棒の中心を基準に左右へはみ出して表示する。 */}
        <div className="mt-1.5 flex h-4 gap-[3px]">
          {data.map((d, i) => (
            <div key={i} className="relative flex-1">
              {i % labelStep === 0 && (
                <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap font-mono text-[10px] text-text-dim">
                  {d.label}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
