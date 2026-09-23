/**
 * BuildBay Creative の目印になる、白地に散らす虹色のぼかし。
 * ロゴの「Creative」と同じ色の並び（マゼンタ→赤→オレンジ→黄→緑→水色→青→紫）。
 * Creativeページと、Creative対象のツールの商品ページで共通に使い、
 * 「ここはCreativeの場所」だと一目で分かるようにする。
 *
 * 親要素に relative と overflow-hidden を付けて使うこと。
 */
const BLURS = [
  { c: "#e91ecf", cls: "-left-24 -top-28 h-[26rem] w-[26rem] opacity-30" },
  { c: "#ff2d55", cls: "left-[22%] -top-40 h-80 w-80 opacity-25" },
  { c: "#ff8a00", cls: "left-[42%] top-[-6rem] h-72 w-72 opacity-25" },
  { c: "#ffd400", cls: "right-[24%] -top-24 h-80 w-80 opacity-30" },
  { c: "#34d399", cls: "-right-20 top-[18%] h-96 w-96 opacity-25" },
  { c: "#06b6d4", cls: "right-[12%] bottom-[-8rem] h-[24rem] w-[24rem] opacity-30" },
  { c: "#3b5bff", cls: "left-[34%] bottom-[-10rem] h-[26rem] w-[26rem] opacity-25" },
  { c: "#a855f7", cls: "-left-16 bottom-[-6rem] h-80 w-80 opacity-25" },
  { c: "#ff4fa3", cls: "left-[60%] top-[30%] h-56 w-56 opacity-20" },
  { c: "#22d3ee", cls: "left-[8%] top-[38%] h-48 w-48 opacity-20" },
];

export default function RainbowBlurs({ subtle = false }: { subtle?: boolean }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {BLURS.map((b, i) => (
        <div
          key={i}
          className={`absolute rounded-full blur-[100px] ${b.cls}`}
          // 商品ページでは本文を読みやすくするため、少し控えめにする
          style={{ backgroundColor: b.c, ...(subtle ? { opacity: 0.16 } : {}) }}
        />
      ))}
    </div>
  );
}
