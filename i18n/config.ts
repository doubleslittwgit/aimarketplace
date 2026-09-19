/**
 * next-intlの設定のうち、クライアントコンポーネントからimportしても安全な部分。
 *
 * i18n/request.ts は next/headers（サーバー専用API）に依存しているため、
 * そちらをクライアントコンポーネントから直接importすると、
 * サーバー専用コードごとクライアント側のビルドに巻き込まれてビルドエラーになる
 * （実際、LanguageSwitcher.tsxがi18n/request.tsをimportしたことでこれが発生した）。
 * そのため、言語一覧やCookie名といった「値だけ」をここに分離している。
 */

export const locales = ["ja", "zh", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "ja";
export const LOCALE_COOKIE = "buildbay-locale";

export function isValidLocale(value: string | undefined): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}
