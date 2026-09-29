import Link from "next/link";
import { useTranslations } from "next-intl";

/**
 * トップページの「探す」入口。
 * キーワード検索と、よく使う条件（無料・ブラウザで使える・オフラインで使える など）のボタンを置き、
 * 押すとその条件で「ツールを探す」（/browse）が開く。詳しい絞り込みは /browse 側で行う。
 * 検索欄は普通のフォームなので、JavaScriptが読み込まれる前でも使える。
 */
const QUICK: { key: string; href: string }[] = [
  { key: "free", href: "/browse?price=free" },
  { key: "sale", href: "/browse?price=sale" },
  { key: "cloud", href: "/browse?runtime=cloud" },
  { key: "local", href: "/browse?runtime=local" },
  { key: "offline", href: "/browse?net=offline" },
  { key: "japanese", href: "/browse?lang=ja" },
  { key: "rating", href: "/browse?rating=4" },
];

export default function HomeToolFinder() {
  const t = useTranslations("browse");

  return (
    <div className="mt-5 space-y-3">
      <form action="/browse" method="get" role="search" className="flex gap-2">
        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-surface px-4 py-3 shadow-sm focus-within:border-border-strong">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-text-muted" aria-hidden>
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="search"
            name="q"
            placeholder={t("searchPlaceholderLong")}
            aria-label={t("searchPlaceholderLong")}
            className="w-full min-w-0 bg-transparent text-[15px] outline-none placeholder:text-text-dim"
          />
        </label>
        <button
          type="submit"
          className="shrink-0 rounded-xl bg-accent-signal px-5 text-[14px] font-semibold text-white transition hover:brightness-110"
        >
          {t("home.button")}
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[12px] font-medium text-text-muted">{t("home.quickTitle")}</span>
        {QUICK.map((q) => (
          <Link
            key={q.key}
            href={q.href}
            className="whitespace-nowrap rounded-lg border border-border bg-bg px-3 py-1.5 text-[12px] font-medium text-text-secondary transition hover:border-accent-ai hover:text-accent-ai"
          >
            {t(`quick.${q.key}`)}
          </Link>
        ))}
        <Link href="/browse" className="whitespace-nowrap text-[12px] font-medium text-accent-signal hover:underline">
          {t("home.advanced")} →
        </Link>
      </div>
    </div>
  );
}
