"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import HeaderSearch from "@/components/HeaderSearch";

/**
 * sm未満（スマホ幅）でだけ表示するハンバーガーメニュー。
 *
 * デスクトップ側のヘッダー（検索バー・「探す」「出品する」リンク）は
 * 元のまま md:block / sm:block の中に残してあり、このコンポーネントは
 * それとは別に「sm:hidden」の範囲だけで完結させている。
 * そのため、このコンポーネントの有無はPC版の見た目に影響しない。
 */
export default function MobileMenu({ isLoggedIn }: { isLoggedIn: boolean }) {
  const t = useTranslations("header");
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={panelRef} className="relative sm:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("menuAriaLabel")}
        aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary transition hover:bg-surface hover:text-text-primary"
      >
        {open ? (
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        ) : (
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(88vw,320px)] rounded-xl border border-border bg-bg p-4 shadow-[0_16px_40px_-12px_rgba(22,35,45,0.25)]">
          <div className="mb-4">
            <HeaderSearch />
          </div>
          <nav className="flex flex-col gap-1 text-[14px]">
            <Link
              href="/browse"
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2.5 text-text-secondary transition hover:bg-surface hover:text-text-primary"
            >
              {t("browse")}
            </Link>
            <Link
              href="/feed"
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2.5 text-text-secondary transition hover:bg-surface hover:text-text-primary"
            >
              {t("feed")}
            </Link>
            <Link
              href="/requests"
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2.5 text-text-secondary transition hover:bg-surface hover:text-text-primary"
            >
              {t("requests")}
            </Link>
            <Link
              href="/creative"
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2.5 font-medium transition hover:bg-surface"
            >
              <span className="bg-gradient-to-r from-purple-500 to-blue-500 bg-clip-text text-transparent">
                {t("creative")}
              </span>
            </Link>
            <Link
              href="/academy"
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2.5 font-medium text-[#9C7A12] transition hover:bg-surface"
            >
              {t("academy")}
            </Link>
            <Link
              href="/submit"
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2.5 text-text-secondary transition hover:bg-surface hover:text-text-primary"
            >
              {t("submit")}
            </Link>
            {!isLoggedIn && (
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-text-secondary transition hover:bg-surface hover:text-text-primary"
              >
                {t("login")}
              </Link>
            )}
          </nav>
        </div>
      )}
    </div>
  );
}
