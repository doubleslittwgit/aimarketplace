"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { setLocale } from "@/app/locale-actions";
import { locales, type Locale } from "@/i18n/config";

const LABELS: Record<Locale, string> = {
  ja: "日本語",
  zh: "繁體中文",
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
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("languageAriaLabel")}
        disabled={isPending}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary transition hover:bg-surface hover:text-text-primary disabled:opacity-60"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18" />
          <path d="M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18Z" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-40 rounded-lg border border-border bg-surface py-1.5 shadow-lg">
          {locales.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => choose(l)}
              className={`flex w-full items-center justify-between px-3.5 py-2 text-left text-[13px] transition hover:bg-surface-raised ${
                l === locale ? "text-accent-signal" : "text-text-secondary"
              }`}
            >
              {LABELS[l]}
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
