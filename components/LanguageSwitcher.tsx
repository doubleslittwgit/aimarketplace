"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { setLocale } from "@/app/locale-actions";
import { locales, type Locale } from "@/i18n/config";

/**
 * 言語名はその言語自身で書く（今の表示言語が読めない人でも、自分の言語を見つけられるように）。
 * 国旗は使わない：国旗は「国」を表し「言語」と一致しない（英語や繁体字は複数の国・地域で
 * 使われる）うえ、台湾の旗の絵文字は一部の端末で表示されないため。
 */
const LABELS: Record<Locale, string> = {
  ja: "日本語",
  zh: "繁體中文",
  en: "English",
};

/** ヘッダーのボタンに出す短い表記（幅を取りすぎないように） */
const SHORT: Record<Locale, string> = {
  ja: "日本語",
  zh: "繁中",
  en: "EN",
};

/** 選択肢の下に小さく添える英語名（どの言語か迷ったときの手がかり） */
const ENGLISH_NAME: Record<Locale, string> = {
  ja: "Japanese",
  zh: "Traditional Chinese",
  en: "English",
};

export default function LanguageSwitcher() {
  const t = useTranslations("header");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function choose(next: Locale) {
    setOpen(false);
    if (next === locale) return;
    startTransition(async () => {
      await setLocale(next);
      router.refresh();
    });
  }

  return (
    <div ref={ref} className="relative">
      {/* 以前は地球儀アイコンだけで「言語を変えられる場所」だと気づきにくかったため、
          色付きのボタンに今の言語名を表示する */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("languageAriaLabel")}
        aria-expanded={open}
        disabled={isPending}
        className="flex h-9 items-center gap-1.5 rounded-full border border-accent-ai/30 bg-accent-ai-dim px-3 text-[12px] font-medium text-accent-ai transition hover:border-accent-ai/60 disabled:opacity-60"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18" />
          <path d="M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18Z" />
        </svg>
        <span className="whitespace-nowrap">{SHORT[locale]}</span>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={`transition ${open ? "rotate-180" : ""}`}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-48 rounded-lg border border-border bg-surface py-1.5 shadow-lg">
          {locales.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => choose(l)}
              className={`flex w-full items-center justify-between px-3.5 py-2 text-left text-[13px] transition hover:bg-surface-raised ${
                l === locale ? "text-accent-signal" : "text-text-secondary"
              }`}
            >
              <span>
                <span className="block font-medium">{LABELS[l]}</span>
                <span className="block text-[11px] text-text-dim">{ENGLISH_NAME[l]}</span>
              </span>
              {l === locale && (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
