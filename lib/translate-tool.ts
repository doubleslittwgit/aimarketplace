import { createAdminClient } from "@/lib/supabase/admin";
import { translateTexts, SUPPORTED_TRANSLATION_LOCALES } from "@/lib/deepl";

/**
 * 出品者が書いた「キャッチコピー・概要」を、対応する全言語へ翻訳し、
 * tool_translationsテーブルに保存する。
 *
 * 【商品名（タイトル）はあえて翻訳しない】
 * ツール名は、多くの場合ブランド名・固有名詞としての意味合いが強く、
 * DeepLに通すと意図しない訳になったり、そもそも意味が壊れたりする
 * （例: ロゴのように扱っている名前が、直訳されて別物になってしまう）。
 * そのため、name（商品名）はどのロケールでも原文のまま保存する。
 *
 * 出品の公開・更新のタイミングで呼ぶ。翻訳の失敗は握りつぶし
 * （console.errorのみ）、出品自体の成否には影響させない
 * — 翻訳が無くても日本語表示で商品ページは成立するため。
 */
export async function translateAndSaveTool(
  toolId: string,
  name: string,
  tagline: string,
  description: string
): Promise<void> {
  const admin = createAdminClient();

  await Promise.all(
    SUPPORTED_TRANSLATION_LOCALES.map(async (locale) => {
      const translated = await translateTexts([tagline, description], locale);
      if (!translated) return;

      const [tTagline, tDescription] = translated;
      const { error } = await admin.from("tool_translations").upsert(
        {
          tool_id: toolId,
          locale,
          name,
          tagline: tTagline || tagline,
          description: tDescription || description,
        },
        { onConflict: "tool_id,locale" }
      );

      if (error) {
        console.error(`[translateAndSaveTool] 保存に失敗 (locale=${locale}):`, error.message);
      }
    })
  );
}
