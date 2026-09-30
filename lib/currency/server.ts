import { cookies, headers } from "next/headers";
import {
  COUNTRY_CURRENCY,
  CURRENCY_COOKIE,
  FALLBACK_RATES,
  LOCALE_CURRENCY,
  isCurrency,
  type Currency,
} from "./config";

/**
 * 表示通貨と為替レートを決める（サーバー専用）。
 * 考え方は lib/currency/config.ts の説明を参照。
 */

export type DisplayCurrency = {
  currency: Currency;
  /** 1円あたりの金額 */
  rate: number;
  /** 本人がメニューで選んだ通貨か（false ならアクセス元の国・言語からの自動判定） */
  chosen: boolean;
};

const RATES_URL = "https://open.er-api.com/v6/latest/JPY";

/**
 * 1円あたりの各通貨のレートを取る。
 * ExchangeRate-API（無料・キー不要、1日1回更新）を使い、6時間キャッシュする。
 * 取れなかったときは、おおよその固定値を使う（目安の表示なので、止めるよりはよい）。
 * 利用条件として、レートを使うページにクレジット表記が要る（components/RatesAttribution.tsx）。
 */
async function getRates(): Promise<Record<string, number>> {
  try {
    // 取得が遅いときに全ページの表示を待たせないよう、3秒で打ち切る
    const res = await fetch(RATES_URL, {
      cache: "force-cache",
      next: { revalidate: 60 * 60 * 6 },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return FALLBACK_RATES;
    const data = (await res.json()) as { result?: string; rates?: Record<string, number> };
    if (data.result !== "success" || !data.rates) return FALLBACK_RATES;
    return data.rates;
  } catch {
    return FALLBACK_RATES;
  }
}

export async function getDisplayCurrency(locale: string): Promise<DisplayCurrency> {
  const [cookieStore, h] = await Promise.all([cookies(), headers()]);

  const saved = cookieStore.get(CURRENCY_COOKIE)?.value;
  const country = h.get("x-vercel-ip-country")?.toUpperCase() ?? null;

  let currency: Currency;
  let chosen = false;
  if (isCurrency(saved)) {
    currency = saved;
    chosen = true;
  } else if (country) {
    currency = COUNTRY_CURRENCY[country] ?? "USD";
  } else {
    currency = LOCALE_CURRENCY[locale] ?? "JPY";
  }

  if (currency === "JPY") return { currency, rate: 1, chosen };

  const rates = await getRates();
  const rate = rates[currency];
  const safeRate = typeof rate === "number" && rate > 0 && Number.isFinite(rate) ? rate : FALLBACK_RATES[currency];
  return { currency, rate: safeRate, chosen };
}
