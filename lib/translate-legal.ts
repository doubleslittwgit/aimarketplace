import { createAdminClient } from "@/lib/supabase/admin";
import { translateHtml, SUPPORTED_TRANSLATION_LOCALES } from "@/lib/deepl";

/**
 * 法務ページ（利用規約等）のHTML全体を、対応する全言語へ翻訳し
 * legal_translationsテーブルに保存する。
 *
 * 法務ページの内容はコードに直接書かれた静的なもので、
 * デプロイのたびに変わり得るため、内容が変わったのに古い翻訳が
 * 残り続けることのないよう、呼び出し側は必ず最新の日本語HTMLを渡すこと
 * （このファイル自体はキャッシュの中身の鮮度を検証しない）。
 */
export async function translateAndSaveLegalPage(
  slug: string,
  html: string
): Promise<void> {
  const admin = createAdminClient();

  await Promise.all(
    SUPPORTED_TRANSLATION_LOCALES.map(async (locale) => {
      const translated = await translateHtml(html, locale);
      if (!translated) return;

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
