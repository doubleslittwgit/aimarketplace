import { createAdminClient } from "@/lib/supabase/admin";
import { translateTexts, SUPPORTED_TRANSLATION_LOCALES } from "@/lib/deepl";

/**
 * レビューのコメントを、対応する全言語へ翻訳しreview_translationsに保存する。
 * コメントが空（評価のみの投稿）の場合は何もしない。
 */
export async function translateAndSaveReview(
  reviewId: string,
  comment: string | null
): Promise<void> {
  if (!comment || !comment.trim()) return;

  const admin = createAdminClient();

  await Promise.all(
    SUPPORTED_TRANSLATION_LOCALES.map(async (locale) => {
      const translated = await translateTexts([comment], locale);
      if (!translated || !translated[0]) return;

      const { error } = await admin.from("review_translations").upsert(
        { review_id: reviewId, locale, comment: translated[0] },
        { onConflict: "review_id,locale" }
      );

      if (error) {
        console.error(`[translateAndSaveReview] 保存に失敗 (locale=${locale}):`, error.message);
      }
    })
  );
}
