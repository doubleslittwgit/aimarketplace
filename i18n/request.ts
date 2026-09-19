import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

/**
 * 多言語対応の設定。
 *
 * URLに /ja /zh /en のようなプレフィックスを付ける方式（next-intlの標準）ではなく、
 * Cookieに保存した言語設定を見る方式にしている。
 * 理由: 既存のURL構造（/apps/xxx, /browse など）をそのまま維持でき、
 * サイトマップ・OGP・過去に共有されたリンクを一切壊さずに導入できるため。
 */

export const locales = ["ja", "zh", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "ja";
export const LOCALE_COOKIE = "buildbay-locale";

export function isValidLocale(value: string | undefined): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
  const locale = isValidLocale(cookieLocale) ? cookieLocale : defaultLocale;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
