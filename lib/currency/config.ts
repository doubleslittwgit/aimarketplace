/**
 * 「現地の通貨での目安の価格」を出すための設定（クライアントからimportしても安全な部分）。
 *
 * 決済は常に日本円で行う（Stripeの設定・出品者への支払い・返金がすべて円で動いているため）。
 * ここで出すのは、海外の人が価格の感覚をつかめるようにするための「目安」だけで、
 * 実際の請求額はカード会社の為替レートで決まる。そのため、表示には必ず「約」を付ける。
 *
 * どの通貨で出すか:
 *   1. 本人が言語メニューで選んだ通貨（Cookie）
 *   2. アクセス元の国（Vercelが付ける x-vercel-ip-country）
 *   3. 表示言語（日本語→円、繁體中文→台湾ドル、English→米ドル）
 * 日本円のときは、目安は出さない（円の価格そのものなので）。
 */

export const CURRENCY_COOKIE = "buildbay-currency";

/** 選べる通貨（並び順はメニューの表示順） */
export const CURRENCIES = [
  "JPY",
  "TWD",
  "USD",
  "HKD",
  "CNY",
  "KRW",
  "SGD",
  "THB",
  "MYR",
  "PHP",
  "VND",
  "IDR",
  "INR",
  "EUR",
  "GBP",
  "CHF",
  "AUD",
  "NZD",
  "CAD",
] as const;
export type Currency = (typeof CURRENCIES)[number];

export function isCurrency(value: string | undefined | null): value is Currency {
  return !!value && (CURRENCIES as readonly string[]).includes(value);
}

const EURO_COUNTRIES = [
  "AT", "BE", "CY", "DE", "EE", "ES", "FI", "FR", "GR", "HR", "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PT", "SI", "SK",
];

/** アクセス元の国 → 通貨。一覧に無い国は米ドルにする */
export const COUNTRY_CURRENCY: Record<string, Currency> = {
  JP: "JPY",
  TW: "TWD",
  HK: "HKD",
  MO: "HKD",
  CN: "CNY",
  KR: "KRW",
  SG: "SGD",
  TH: "THB",
  MY: "MYR",
  PH: "PHP",
  VN: "VND",
  ID: "IDR",
  IN: "INR",
  GB: "GBP",
  CH: "CHF",
  AU: "AUD",
  NZ: "NZD",
  CA: "CAD",
  US: "USD",
  ...Object.fromEntries(EURO_COUNTRIES.map((c) => [c, "EUR" as Currency])),
};

/** 国が分からないときの、表示言語ごとの通貨 */
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
  HKD: 0.053,
  CNY: 0.049,
  KRW: 9.4,
  SGD: 0.0088,
  THB: 0.22,
  MYR: 0.029,
  PHP: 0.39,
  VND: 178,
  IDR: 112,
  INR: 0.6,
  EUR: 0.0058,
  GBP: 0.005,
  CHF: 0.0054,
  AUD: 0.0103,
  NZD: 0.0115,
  CAD: 0.0094,
};

/** 小数点以下まで出す通貨（それ以外は整数に丸める） */
const DECIMAL_CURRENCIES: Currency[] = ["USD", "EUR", "GBP", "CHF", "SGD", "AUD", "NZD", "CAD", "MYR"];

/**
 * 円の金額を、指定の通貨の目安の金額（記号つき）にする。例: 200円 → "NT$42"、"$1.36"
 * 記号は国をまたいで紛れにくい英語圏の書き方（NT$ / HK$ / CN¥ など）にそろえる。
 */
export function formatConverted(yen: number, currency: Currency, rate: number): string {
  const amount = yen * rate;
  const decimals = DECIMAL_CURRENCIES.includes(currency) && amount < 1000 ? 2 : 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    currencyDisplay: "symbol",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}
