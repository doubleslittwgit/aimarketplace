import { useTranslations } from "next-intl";

/**
 * 「クラウド／ローカル」の表示。
 * ブラウザで使えるのか、ダウンロードしてPCで動かすのかは、買う前にいちばん大事な情報の一つなので、
 * 色付き・アイコン付き・太字で目立たせる。
 *   - クラウド（雲端）… BuildBayの青（空・雲のイメージ）
 *   - ローカル（本機）… 濃紺（手元のパソコンのイメージ）
 */
export default function RuntimeBadge({
  runtime,
  size = "md",
  className = "",
}: {
  runtime: "cloud" | "local" | string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const t = useTranslations("runtimeBadge");
  const isLocal = runtime === "local";
  const sizing = {
    sm: "gap-1 px-2 py-0.5 text-[10px]",
    md: "gap-1.5 px-2.5 py-1 text-[12px]",
    lg: "gap-1.5 px-3 py-1.5 text-[13px]",
  }[size];
  const icon = size === "sm" ? 11 : size === "md" ? 13 : 15;

  return (
    <span
      className={`inline-flex items-center rounded-full font-bold tracking-wide text-white shadow-sm ${sizing} ${
        isLocal ? "bg-text-primary" : "bg-accent-ai"
      } ${className}`}
    >
      {isLocal ? (
        // パソコンのアイコン（ダウンロードして自分のPCで動かす）
        <svg width={icon} height={icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="3" y="4" width="18" height="12" rx="2" />
          <path d="M8 20h8M12 16v4" />
        </svg>
      ) : (
        // 雲のアイコン（ブラウザで使う）
        <svg width={icon} height={icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M7 18a4.5 4.5 0 0 1-.5-8.97A6 6 0 0 1 18 8.5a4.5 4.5 0 0 1-.5 9.5Z" />
        </svg>
      )}
      {isLocal ? t("local") : t("cloud")}
    </span>
  );
}
