import { createAdminClient } from "@/lib/supabase/admin";
import { translateHtml, SUPPORTED_TRANSLATION_LOCALES, type SupportedLocale } from "@/lib/deepl";

/**
 * 法務ページ（利用規約等）のHTML全体を、対応する全言語へ翻訳し
 * legal_translationsテーブルに保存する。
 *
 * 法務ページの内容はコードに直接書かれた静的なもので、
 * デプロイのたびに変わり得るため、内容が変わったのに古い翻訳が
 * 残り続けることのないよう、呼び出し側は必ず最新の日本語HTMLを渡すこと
 * （このファイル自体はキャッシュの中身の鮮度を検証しない）。
 *
 * overrides: 人名など、DeepLの自動翻訳（ローマ字化の揺れ等）に任せたくない
 * 部分がある場合に、翻訳結果に対して単純な文字列置換をかけるための仕組み。
 * 例: 英語版だけ「後藤 脩」を「Shu Goto」に固定したい、など。
 */
export async function translateAndSaveLegalPage(
  slug: string,
  html: string,
  overrides?: Partial<Record<SupportedLocale, [string, string][]>>
): Promise<void> {
  const admin = createAdminClient();

  await Promise.all(
    SUPPORTED_TRANSLATION_LOCALES.map(async (locale) => {
      let translated = await translateHtml(html, locale);
      if (!translated) return;

      for (const [from, to] of overrides?.[locale] ?? []) {
        translated = translated.split(from).join(to);
      }

      const { error } = await admin.from("legal_translations").upsert(
        { slug, locale, html: translated },
        { onConflict: "slug,locale" }
      );

      if (error) {
        console.error(`[translateAndSaveLegalPage] 保存に失敗 (locale=${locale}):`, error.message);
      }
    })
  );
}
