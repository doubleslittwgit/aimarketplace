"use server";

import { cookies } from "next/headers";
import { LOCALE_COOKIE, isValidLocale, type Locale } from "@/i18n/config";
import { CURRENCY_COOKIE, isCurrency, type Currency } from "@/lib/currency/config";

export async function setLocale(locale: Locale): Promise<void> {
  if (!isValidLocale(locale)) return;

  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, locale, {
    // 1年間保持。ログイン状態とは無関係の、純粋な表示上の好みなので
    // httpOnlyにする必要はない（クライアント側からも読めて構わない）。
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
    sameSite: "lax",
  });
}

/**
 * 価格の横に出す「現地の通貨での目安」の通貨を選ぶ。
 * "auto" を選ぶと保存を消し、アクセス元の国から自動で決める状態に戻す。
 */
export async function setCurrency(currency: Currency | "auto"): Promise<void> {
  const cookieStore = await cookies();
  if (currency === "auto") {
    cookieStore.delete(CURRENCY_COOKIE);
    return;
  }
  if (!isCurrency(currency)) return;
  cookieStore.set(CURRENCY_COOKIE, currency, {
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
    sameSite: "lax",
  });
}
