/**
 * 「現地の通貨での目安の価格」を出すための設定（クライアントからimportしても安全な部分）。
 *
 * 決済は常に日本円で行う（Stripeの設定・出品者への支払い・返金がすべて円で動いているため）。
 * ここで出すのは、価格の感覚をつかみやすくするための「目安」だけで、
 * 実際の請求額はカード会社の為替レートで決まる。そのため、表示には必ず「約」「≈」を付ける。
 *
 * どの通貨で出すかは表示言語だけで決める（円の価格は常に出す）:
 *   日本語 → 円だけ（目安は出さない）
 *   繁體中文 → 円 ＋ 約 NT$（台湾ドル）
 *   English → 円 ＋ ≈ $（米ドル）
 */

export type Currency = "JPY" | "TWD" | "USD";

export const LOCALE_CURRENCY: Record<string, Currency> = {
  ja: "JPY",
  zh: "TWD",
  en: "USD",
};

/**
 * 為替レートが取れなかったときに使う、おおよその値（1円あたり）。
 * 目安の表示にしか使わないので、多少古くても問題ない。
 */
export const FALLBACK_RATES: Record<Currency, number> = {
  JPY: 1,
  TWD: 0.21,
  USD: 0.0068,
};

/**
 * 円の金額を、指定の通貨の目安の金額（記号つき）にする。例: 200円 → "NT$42"、"$1.36"
 * 台湾ドルは「$」だけだと米ドルと紛れるので、NT$ と書く英語圏の書き方にそろえる。
 * 米ドルは1,000未満ならセント（小数2桁）まで、台湾ドルは整数に丸める。
 */
export function formatConverted(yen: number, currency: Currency, rate: number): string {
  const amount = yen * rate;
  const decimals = currency === "USD" && amount < 1000 ? 2 : 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    currencyDisplay: "symbol",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}
