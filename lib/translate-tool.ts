import { createAdminClient } from "@/lib/supabase/admin";
import { translateTexts, SUPPORTED_TRANSLATION_LOCALES } from "@/lib/deepl";

/**
 * 出品者が書いた「商品名・キャッチコピー・概要」を、対応する全言語へ翻訳し、
 * tool_translationsテーブルに保存する。
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
      const translated = await translateTexts([name, tagline, description], locale);
      if (!translated) return;

      const [tName, tTagline, tDescription] = translated;
      const { error } = await admin.from("tool_translations").upsert(
        {
          tool_id: toolId,
          locale,
          name: tName || name,
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
