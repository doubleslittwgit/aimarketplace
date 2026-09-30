"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { formatConverted, type Currency } from "@/lib/currency/config";

/**
 * 表示通貨と為替レートを、ページ中の価格表示に配る。
 * 値はサーバー側（app/layout.tsx → lib/currency/server.ts）で決めて渡す。
 */

type Value = { currency: Currency; rate: number; chosen: boolean };

const CurrencyContext = createContext<Value>({ currency: "JPY", rate: 1, chosen: false });

export function CurrencyProvider({ value, children }: { value: Value; children: ReactNode }) {
  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useDisplayCurrency() {
  return useContext(CurrencyContext);
}

/**
 * 円の価格の横に添える「約 NT$42」のような目安。
 * 表示通貨が日本円のとき・無料（0円）のときは何も出さない。
 */
export function ApproxPrice({ yen, className = "" }: { yen: number; className?: string }) {
  const { currency, rate } = useDisplayCurrency();
  const t = useTranslations("currency");
  if (currency === "JPY" || !(yen > 0)) return null;
  return (
    <span className={`whitespace-nowrap ${className}`} title={t("approxTitle")}>
      {t("approx", { amount: formatConverted(yen, currency, rate) })}
    </span>
  );
}

/**
 * 為替レートの提供元の表記（ExchangeRate-API の利用条件）。
 * 日本円以外の目安を出しているときだけ、フッターに小さく出す。
 */
export function RatesAttribution() {
  const { currency } = useDisplayCurrency();
  const t = useTranslations("currency");
  if (currency === "JPY") return null;
  return (
    <p className="mt-3 text-[11px] text-text-dim">
      {t("attributionPrefix")}{" "}
      <a href="https://www.exchangerate-api.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-text-secondary">
        Rates By Exchange Rate API
      </a>
    </p>
  );
}
