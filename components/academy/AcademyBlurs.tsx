/**
 * BuildBay Academy の目印になる、白地に散らす緑と金のぼかし。
 * ロゴの「Academy」と同じ、深緑 → セージ → クリーム → 金 の並び。
 * Creative の虹色と対になる「学び」の色で、BuildBay本体の白い見た目は保ったまま
 * 「ここはAcademyの場所」だと分かるようにする。
 *
 * ロゴの中央（a・d・e）はごく薄いクリーム色で白地だと見えにくいため、
 * ヒーローでは左上寄り（ロゴの背後）に深緑とセージを厚めに置いている。
 * 親要素に relative と overflow-hidden を付けて使うこと。
 */
// スマホ（sm未満）は、小さな色のかたまりを端と角に散らし、中央に白を残す。
// ただしロゴの中央（a・d・e）はごく薄いクリーム色なので、ロゴの近く（上部）には
// 深緑とセージを置いて文字が読めるようにしている。sm以上は従来の配置。
const BLURS = [
  { c: "#173F35", cls: "-left-12 -top-10 h-44 w-44 opacity-[0.5] sm:opacity-30 sm:-left-24 sm:-top-24 sm:h-[26rem] sm:w-[26rem]" },
  { c: "#2f7a5b", cls: "hidden sm:block sm:left-[18%] sm:top-[-3rem] sm:h-80 sm:w-80 opacity-30" },
  { c: "#8fb89a", cls: "left-[42%] -top-6 h-32 w-32 opacity-[0.6] sm:opacity-35 sm:left-[34%] sm:top-[12%] sm:h-72 sm:w-72" },
  { c: "#C9A227", cls: "-right-8 -top-6 h-32 w-32 opacity-[0.6] sm:opacity-30 sm:right-[22%] sm:-top-28 sm:h-80 sm:w-80" },
  { c: "#e8c65a", cls: "-right-12 top-[46%] h-36 w-36 opacity-[0.6] sm:opacity-30 sm:-right-20 sm:top-[16%] sm:h-96 sm:w-96" },
  { c: "#173F35", cls: "hidden sm:block sm:right-[10%] sm:bottom-[-9rem] sm:h-[24rem] sm:w-[24rem] opacity-20" },
  { c: "#b8902a", cls: "left-[58%] -bottom-12 h-36 w-36 opacity-[0.45] sm:opacity-25 sm:left-[40%] sm:bottom-[-10rem] sm:h-[24rem] sm:w-[24rem]" },
  { c: "#4f8f6f", cls: "-left-12 bottom-[14%] h-36 w-36 opacity-[0.5] sm:opacity-25 sm:-left-16 sm:bottom-[-6rem] sm:h-80 sm:w-80" },
  { c: "#f0d77a", cls: "hidden sm:block sm:left-[62%] sm:top-[34%] sm:h-56 sm:w-56 opacity-25" },
];

export default function AcademyBlurs({ subtle = false }: { subtle?: boolean }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {BLURS.map((b, i) => (
        <div
          key={i}
          className={`absolute rounded-full blur-[40px] sm:blur-[100px] ${b.cls}`}
          // 講座ページでは本文を読みやすくするため、少し控えめにする
          style={{ backgroundColor: b.c, ...(subtle ? { opacity: 0.14 } : {}) }}
        />
      ))}
    </div>
  );
}
