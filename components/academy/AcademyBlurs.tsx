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
const BLURS = [
  { c: "#173F35", cls: "-left-24 -top-24 h-[26rem] w-[26rem] opacity-30" },
  { c: "#2f7a5b", cls: "left-[18%] top-[-3rem] h-80 w-80 opacity-30" },
  { c: "#8fb89a", cls: "left-[34%] top-[12%] h-72 w-72 opacity-30" },
  { c: "#C9A227", cls: "right-[22%] -top-28 h-80 w-80 opacity-30" },
  { c: "#e8c65a", cls: "-right-20 top-[16%] h-96 w-96 opacity-30" },
  { c: "#173F35", cls: "right-[10%] bottom-[-9rem] h-[24rem] w-[24rem] opacity-20" },
  { c: "#b8902a", cls: "left-[40%] bottom-[-10rem] h-[24rem] w-[24rem] opacity-25" },
  { c: "#4f8f6f", cls: "-left-16 bottom-[-6rem] h-80 w-80 opacity-25" },
  { c: "#f0d77a", cls: "left-[62%] top-[34%] h-56 w-56 opacity-25" },
];

export default function AcademyBlurs({ subtle = false }: { subtle?: boolean }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {BLURS.map((b, i) => (
        <div
          key={i}
          className={`absolute rounded-full blur-[100px] ${b.cls}`}
          // 講座ページでは本文を読みやすくするため、少し控えめにする
          style={{ backgroundColor: b.c, ...(subtle ? { opacity: 0.14 } : {}) }}
        />
      ))}
    </div>
  );
}
