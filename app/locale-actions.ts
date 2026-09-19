"use server";

import { cookies } from "next/headers";
import { LOCALE_COOKIE, isValidLocale, type Locale } from "@/i18n/config";

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
