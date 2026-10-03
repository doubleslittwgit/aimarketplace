/**
 * 出品・編集フォームの画像欄の下に出す「16:9 の画像を使ってください」の案内。
 * 小さな補足文に埋もれないよう、少し大きめの文字と色付きの背景で目立たせる。
 */
export default function ImageRatioHint({ text }: { text: string }) {
  return (
    <p className="mt-3 flex items-center gap-2 rounded-lg bg-accent-signal-dim px-3 py-2 text-[14px] font-semibold text-text-primary">
      <svg
        width="20"
        height="14"
        viewBox="0 0 20 14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        className="shrink-0 text-accent-signal"
        aria-hidden="true"
      >
        <rect x="1" y="1" width="18" height="12" rx="2" />
      </svg>
      {text}
    </p>
  );
}
