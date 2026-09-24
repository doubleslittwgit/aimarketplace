/**
 * BuildBay Creative の目印になる、白地に散らす虹色のぼかし。
 * ロゴの「Creative」と同じ色の並び（マゼンタ→赤→オレンジ→黄→緑→水色→青→紫）。
 * Creativeページと、Creative対象のツールの商品ページで共通に使い、
 * 「ここはCreativeの場所」だと一目で分かるようにする。
 *
 * 親要素に relative と overflow-hidden を付けて使うこと。
 */
// スマホ（sm未満）は、小さな色の「かたまり」を端と角に散らし、中央に白を残す。
// パソコンと同じ大きさのまま狭い画面に置くと、ぼかし同士が重なって画面全体が
// 色で塗りつぶされてしまうため（実際にそうなっていた）。sm以上は従来の配置。
const BLURS = [
  { c: "#e91ecf", cls: "-left-12 -top-12 h-44 w-44 opacity-[0.6] sm:opacity-30 sm:-left-24 sm:-top-28 sm:h-[26rem] sm:w-[26rem]" },
  { c: "#ff2d55", cls: "hidden sm:block sm:left-[22%] sm:-top-40 sm:h-80 sm:w-80 opacity-25" },
  { c: "#ff8a00", cls: "left-[55%] -top-10 h-32 w-32 opacity-[0.6] sm:opacity-25 sm:left-[42%] sm:top-[-6rem] sm:h-72 sm:w-72" },
  { c: "#ffd400", cls: "-right-8 top-[20%] h-32 w-32 opacity-[0.6] sm:opacity-30 sm:right-[24%] sm:-top-24 sm:h-80 sm:w-80" },
  { c: "#34d399", cls: "-right-12 top-[48%] h-36 w-36 opacity-[0.6] sm:opacity-25 sm:-right-20 sm:top-[18%] sm:h-96 sm:w-96" },
  { c: "#06b6d4", cls: "right-[5%] -bottom-12 h-40 w-40 opacity-[0.6] sm:opacity-30 sm:right-[12%] sm:bottom-[-8rem] sm:h-[24rem] sm:w-[24rem]" },
  { c: "#3b5bff", cls: "-left-12 bottom-[12%] h-36 w-36 opacity-[0.6] sm:opacity-25 sm:left-[34%] sm:bottom-[-10rem] sm:h-[26rem] sm:w-[26rem]" },
  { c: "#a855f7", cls: "hidden sm:block sm:-left-16 sm:bottom-[-6rem] sm:h-80 sm:w-80 opacity-25" },
  { c: "#ff4fa3", cls: "hidden sm:block sm:left-[60%] sm:top-[30%] sm:h-56 sm:w-56 opacity-20" },
  { c: "#22d3ee", cls: "hidden sm:block sm:left-[8%] sm:top-[38%] sm:h-48 sm:w-48 opacity-20" },
];

export default function RainbowBlurs({ subtle = false }: { subtle?: boolean }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {BLURS.map((b, i) => (
        <div
          key={i}
          className={`absolute rounded-full blur-[40px] sm:blur-[100px] ${b.cls}`}
          // 商品ページでは本文を読みやすくするため、少し控えめにする
          style={{ backgroundColor: b.c, ...(subtle ? { opacity: 0.16 } : {}) }}
        />
      ))}
    </div>
  );
}
