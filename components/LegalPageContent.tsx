import { after } from "next/server";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { translateAndSaveLegalPage } from "@/lib/translate-legal";
import type { Locale } from "@/i18n/config";

/**
 * 法務ページの本文を表示する。
 *
 * 日本語の場合はそのまま、それ以外の言語では legal_translations に
 * キャッシュされた翻訳があればそれを、無ければ日本語のまま表示しつつ
 * 裏側で翻訳を予約する（次回以降のアクセスから反映される）。
 *
 * htmlは常にこのアプリのコード（各法務ページファイル）由来の
 * 固定文字列であり、ユーザー入力ではないため dangerouslySetInnerHTML
 * を使って問題ない。
 */
export default async function LegalPageContent({
  slug,
  html,
}: {
  slug: string;
  html: string;
}) {
  const locale = (await getLocale()) as Locale;

  if (locale === "ja") {
    return <div dangerouslySetInnerHTML={{ __html: html }} />;
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("legal_translations")
    .select("html")
    .eq("slug", slug)
    .eq("locale", locale)
    .maybeSingle();

  if (data?.html) {
    return <div dangerouslySetInnerHTML={{ __html: data.html }} />;
  }

  after(() => translateAndSaveLegalPage(slug, html));
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
