"use client";

import { useTranslations } from "next-intl";
import { TOOL_LANGUAGES, TOOL_LANGUAGE_NATIVE_NAMES, type ToolLanguage } from "@/lib/tool-languages";

/**
 * 出品・編集フォームの「対応言語」の選択（複数選択）。
 * 選んだ値は hidden の input（name="uiLanguages"、カンマ区切り）でフォームと一緒に送られる。
 */
export default function ToolLanguagePicker({
  value,
  onChange,
}: {
  value: ToolLanguage[];
  onChange: (v: ToolLanguage[]) => void;
}) {
  const t = useTranslations("submit.languages");

  function toggle(lang: ToolLanguage) {
    const next = value.includes(lang) ? value.filter((l) => l !== lang) : [...value, lang];
    onChange(TOOL_LANGUAGES.filter((l) => next.includes(l)));
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {TOOL_LANGUAGES.map((lang) => {
          const active = value.includes(lang);
          return (
            <button
              key={lang}
              type="button"
              aria-pressed={active}
              onClick={() => toggle(lang)}
              className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] transition ${
                active
                  ? "border-accent-ai bg-accent-ai-dim font-medium text-accent-ai"
                  : "border-border bg-surface text-text-secondary hover:border-border-strong"
              }`}
            >
              {active && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              )}
              {lang === "other" ? t("other") : TOOL_LANGUAGE_NATIVE_NAMES[lang]}
            </button>
          );
        })}
      </div>
      <input type="hidden" name="uiLanguages" value={value.join(",")} readOnly />
      <p className="mt-2 text-[12px] text-text-dim">{t("hint")}</p>
    </div>
  );
}
