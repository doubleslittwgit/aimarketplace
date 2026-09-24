import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { defaultLocale, isValidLocale, LOCALE_COOKIE, type Locale } from "./config";

/**
 * 多言語対応の設定（サーバー専用）。
 *
 * URLに /ja /zh /en のようなプレフィックスを付ける方式（next-intlの標準）ではなく、
 * Cookieに保存した言語設定を見る方式にしている。
 * Cookieが無い（まだ言語を選んでいない）人には、アクセス元の国から言語を決める。
 * 理由: 既存のURL構造（/apps/xxx, /browse など）をそのまま維持でき、
 * サイトマップ・OGP・過去に共有されたリンクを一切壊さずに導入できるため。
 *
 * このファイルは next/headers に依存しているため、クライアントコンポーネントから
 * 直接importしてはいけない（サーバー専用コードがクライアント側のビルドに
 * 巻き込まれてビルドエラーになる）。クライアント側で言語一覧やCookie名が
 * 必要な場合は、代わりに ./config を使うこと。
 */
/**
 * アクセス元の国ごとの表示言語。一覧に無い国は英語にする。
 * 海外の人も無料ツールなら取引できるため、日本以外からの初回アクセスを
 * 日本語で出すより、読める可能性が高い言語で出す。
 * 中国本土（CN）は簡体字の人が多いが、簡体字版が無いため繁体字にしている
 * （多くの人は繁体字も読める）。
 */
const COUNTRY_LOCALE: Record<string, Locale> = {
  JP: "ja",
  TW: "zh",
  HK: "zh",
  MO: "zh",
  CN: "zh",
};

/**
 * アクセス元の国から表示言語を決める。
 * 国は Vercel がリクエストごとに付けてくる x-vercel-ip-country（IPアドレスから推定した国コード）を使う。
 * 手元での開発時など、この情報が無い場合は null を返し、既定の日本語にする。
 */
function localeFromCountry(country: string | null): Locale | null {
  if (!country) return null;
  return COUNTRY_LOCALE[country.toUpperCase()] ?? "en";
}

/**
 * 検索エンジンやSNSのリンクプレビュー用のロボット。
 * これらは主にアメリカのサーバーから来るため、国で判定すると英語版が
 * 検索結果やSNSのプレビューに載ってしまう。ロボットには既定の日本語を返す。
 */
// 注意：LINE・Instagram・Facebook のアプリ内ブラウザは、人が使う普通のブラウザなので
// ロボット扱いしてはいけない（LINEのアプリ内ブラウザの識別名には「Line/」が含まれるため、
// 最初の版ではこれを誤ってロボット扱いしていた）。リンクのプレビューを作るロボットの
// 名前だけを挙げている（LINEのプレビューは facebookexternalhit を名乗る）。
const CRAWLER_UA =
  /bot\b|bot\/|crawl|spider|slurp|facebookexternalhit|facebookcatalog|embedly|quora link preview|whatsapp\/|skypeuripreview|vkshare/i;

export default getRequestConfig(async () => {
  // 言語の決め方（上から順に優先）:
  //   1. 本人が言語ボタンで選んだ言語（Cookie）… 一度選んだら、どこから開いてもずっとこれ
  //   2. アクセス元の国（台湾なら中国語、日本なら日本語、それ以外は英語）
  //      ※ 検索エンジン・SNSのロボットは除く（日本語のまま）
  //   3. 既定の日本語
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
  const h = await headers();
  const isCrawler = CRAWLER_UA.test(h.get("user-agent") ?? "");
  const locale: Locale = isValidLocale(cookieLocale)
    ? cookieLocale
    : isCrawler
      ? defaultLocale
      : (localeFromCountry(h.get("x-vercel-ip-country")) ?? defaultLocale);

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});

