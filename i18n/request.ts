import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { defaultLocale, isValidLocale, LOCALE_COOKIE } from "./config";

/**
 * 多言語対応の設定（サーバー専用）。
 *
 * URLに /ja /zh /en のようなプレフィックスを付ける方式（next-intlの標準）ではなく、
 * Cookieに保存した言語設定を見る方式にしている。
 * 理由: 既存のURL構造（/apps/xxx, /browse など）をそのまま維持でき、
 * サイトマップ・OGP・過去に共有されたリンクを一切壊さずに導入できるため。
 *
 * このファイルは next/headers に依存しているため、クライアントコンポーネントから
 * 直接importしてはいけない（サーバー専用コードがクライアント側のビルドに
 * 巻き込まれてビルドエラーになる）。クライアント側で言語一覧やCookie名が
 * 必要な場合は、代わりに ./config を使うこと。
 */
export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
  const locale = isValidLocale(cookieLocale) ? cookieLocale : defaultLocale;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});

