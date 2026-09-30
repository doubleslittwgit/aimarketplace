"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

/**
 * スマホ用の、画面下に浮かぶナビゲーションバー（sm未満だけ表示）。
 *
 * - 角の丸いカプセル型で、後ろの画面がすりガラス越しに透けて見える「リキッドグラス」風の質感
 * - 項目: 探す / Creative / 出品する（中央・強調） / Academy / マイページ
 *   （ホームへは画面上部のロゴから戻れるので、バーには入れない）
 * - 今いるページの項目は、バーの中で白いカプセルが浮いて見える
 * - 下にスクロールしている間は隠れ、上に戻すと出てくる（読んでいる内容を邪魔しないため）
 * - 入力に集中する画面（出品・編集・講座を書く・ログイン・管理画面など）では出さない
 */

type Item = {
  key: "browse" | "creative" | "sell" | "academy" | "mypage";
  href: string;
  match: (path: string) => boolean;
};

const ITEMS: Item[] = [
  { key: "browse", href: "/browse", match: (p) => p.startsWith("/browse") || p.startsWith("/apps/") },
  { key: "creative", href: "/creative", match: (p) => p.startsWith("/creative") },
  { key: "sell", href: "/submit", match: (p) => p.startsWith("/submit") },
  { key: "academy", href: "/academy", match: (p) => p.startsWith("/academy") },
  {
    key: "mypage",
    href: "/dashboard",
    match: (p) => p.startsWith("/dashboard") || p.startsWith("/seller") || p.startsWith("/settings"),
  },
];

/** このバーを出さないページ（入力に集中する画面・下に固定ボタンがある画面） */
function hiddenOn(path: string): boolean {
  return (
    path.startsWith("/submit") ||
    path.startsWith("/admin") ||
    path.startsWith("/login") ||
    path.startsWith("/signup") ||
    path.startsWith("/forgot-password") ||
    path.startsWith("/reset-password") ||
    path.startsWith("/mfa") ||
    path.startsWith("/academy/new") ||
    /^\/academy\/[^/]+\/edit/.test(path) ||
    /^\/apps\/[^/]+\/edit/.test(path)
  );
}

export default function MobileTabBar() {
  const t = useTranslations("bottomNav");
  const pathname = usePathname() || "/";
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);

  // 下にスクロールしたら隠し、上に戻したら出す
  useEffect(() => {
    lastY.current = window.scrollY;
    function onScroll() {
      const y = window.scrollY;
      const diff = y - lastY.current;
      if (Math.abs(diff) < 8) return;
      setHidden(diff > 0 && y > 120);
      lastY.current = y;
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (hiddenOn(pathname)) return null;

  return (
    <>
      {/* 最後の内容がバーの裏に隠れないよう、ページの一番下に余白を入れる */}
      <div aria-hidden className="h-24 sm:hidden" />

      <nav
        aria-label={t("ariaLabel")}
        className={`fixed inset-x-3 bottom-[max(12px,env(safe-area-inset-bottom))] z-40 transition-transform duration-300 ease-out sm:hidden ${
          hidden ? "translate-y-[140%]" : "translate-y-0"
        }`}
      >
        <div className="relative mx-auto max-w-md overflow-hidden rounded-full border border-white/60 bg-white/45 shadow-[0_10px_40px_-8px_rgba(22,35,45,0.35),inset_0_1px_0_rgba(255,255,255,0.9),inset_0_-1px_0_rgba(255,255,255,0.25)] backdrop-blur-2xl backdrop-saturate-[1.8]">
          {/* ガラスの表面の光沢（上側が明るく、下に向かって透明に） */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-b from-white/60 via-white/10 to-transparent"
          />
          {/* ふちの淡い色づき（BuildBayの青とコーラルをわずかに映り込ませる） */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(120%_140%_at_0%_100%,rgba(63,169,224,0.14),transparent_55%),radial-gradient(120%_140%_at_100%_0%,rgba(255,107,74,0.10),transparent_55%)]"
          />

          <ul className="relative flex items-center justify-between px-1.5 py-1.5">
            {ITEMS.map((item) => {
              const active = item.match(pathname);
              if (item.key === "sell") {
                return (
                  <li key={item.key} className="flex-1">
                    <Link
                      href={item.href}
                      aria-label={t(item.key)}
                      className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#ff8a6e] to-accent-signal text-white shadow-[0_6px_18px_-4px_rgba(255,107,74,0.65),inset_0_1px_0_rgba(255,255,255,0.45)] transition active:scale-95"
                    >
                      <Icon name="sell" />
                    </Link>
                  </li>
                );
              }
              return (
                <li key={item.key} className="flex-1">
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`mx-auto flex h-12 max-w-[4.5rem] flex-col items-center justify-center gap-0.5 rounded-full text-[10px] font-semibold transition active:scale-95 ${
                      active
                        ? "bg-white/80 text-accent-ai shadow-[0_2px_10px_-2px_rgba(22,35,45,0.2),inset_0_1px_0_rgba(255,255,255,1)]"
                        : "text-text-secondary"
                    }`}
                  >
                    <Icon name={item.key} />
                    <span className="leading-none">{t(item.key)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>
    </>
  );
}

function Icon({ name }: { name: Item["key"] }) {
  const common = {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (name) {
    case "creative":
      // パレット（クリエイター向けツール）
      return (
        <svg {...common}>
          <path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.8-.8 1.8-1.7 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.8-1.7 1.7-1.7H17a4 4 0 0 0 4-4c0-4.4-4-8.2-9-8.2Z" />
          <circle cx="7.5" cy="11" r="1" fill="currentColor" />
          <circle cx="10" cy="7" r="1" fill="currentColor" />
          <circle cx="15" cy="7.5" r="1" fill="currentColor" />
        </svg>
      );
    case "browse":
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      );
    case "sell":
      return (
        <svg {...common} width={22} height={22} strokeWidth={2.6}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case "academy":
      return (
        <svg {...common}>
          <path d="M2 9 12 4l10 5-10 5Z" />
          <path d="M6 11v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5" />
        </svg>
      );
    case "mypage":
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" />
        </svg>
      );
  }
}
