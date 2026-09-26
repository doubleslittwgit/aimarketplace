"use client";

import { useTranslations } from "next-intl";
import { INTERNET_ACCESS_VALUES, type InternetAccess } from "@/lib/internet-access";

/**
 * 出品・編集フォームの「インターネット接続」の選択ボタン。
 * 選んだ値は hidden の input（name="internetAccess"）でフォームと一緒に送られる。
 */
export default function InternetAccessPicker({
  value,
  onChange,
}: {
  value: InternetAccess | null;
  onChange: (v: InternetAccess) => void;
}) {
  const t = useTranslations("submit.internetAccess");

  return (
    <div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {INTERNET_ACCESS_VALUES.map((v) => {
          const active = value === v;
          return (
            <button
              key={v}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(v)}
              className={`rounded-lg border px-4 py-3 text-left transition ${
                active
                  ? "border-accent-ai bg-accent-ai-dim"
                  : "border-border bg-surface hover:border-border-strong"
              }`}
            >
              <p className={`text-[13px] font-medium ${active ? "text-accent-ai" : "text-text-primary"}`}>
                {t(`${v}.label`)}
              </p>
              <p className="mt-0.5 text-[12px] text-text-muted">{t(`${v}.description`)}</p>
            </button>
          );
        })}
      </div>
      <input type="hidden" name="internetAccess" value={value ?? ""} readOnly />
      <p className="mt-2 text-[12px] text-text-dim">{t("hint")}</p>
    </div>
  );
}
