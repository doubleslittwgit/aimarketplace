import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Locale } from "@/i18n/config";
import { translateAndSaveTool } from "@/lib/translate-tool";
import { translateAndSaveReview } from "@/lib/translate-review";

type Translatable = {
  id: string;
  name: string;
  tagline: string;
  description: string;
};

/**
 * ツール一覧（またはツール1件）に、指定ロケールのキャッシュ済み翻訳があれば
 * 上書き適用する。無いものは、このリクエストのレスポンスを遅らせずに
 * after() で裏側で翻訳しておき、次回以降のアクセスから反映されるようにする。
 *
 * ロケールが日本語の場合は何もしない（原文がそのまま日本語のため）。
 */
export async function applyToolTranslations<T extends Translatable>(
  supabase: SupabaseClient,
  items: T[],
  locale: Locale
): Promise<T[]> {
  if (locale === "ja" || items.length === 0) return items;

  const ids = items.map((i) => i.id);
  const { data: translations } = await supabase
    .from("tool_translations")
    .select("tool_id, name, tagline, description")
    .in("tool_id", ids)
    .eq("locale", locale);

  const map = new Map((translations ?? []).map((t) => [t.tool_id, t]));
  const missing: T[] = [];

  const result = items.map((item) => {
    const t = map.get(item.id);
    if (!t) {
      missing.push(item);
      return item;
    }
    return { ...item, name: t.name, tagline: t.tagline, description: t.description };
  });

  if (missing.length > 0) {
    after(async () => {
      for (const item of missing) {
        await translateAndSaveTool(item.id, item.name, item.tagline, item.description);
      }
    });
  }

  return result;
}

type TranslatableReview = { id: string; comment: string | null };

/**
 * レビュー一覧に、指定ロケールのキャッシュ済み翻訳（コメント文のみ）があれば
 * 上書き適用する。無いものは同様にafter()で裏側の翻訳を予約する。
 */
export async function applyReviewTranslations<T extends TranslatableReview>(
  supabase: SupabaseClient,
  reviews: T[],
  locale: Locale
): Promise<T[]> {
  if (locale === "ja" || reviews.length === 0) return reviews;

  const ids = reviews.map((r) => r.id);
  const { data: translations } = await supabase
    .from("review_translations")
    .select("review_id, comment")
    .in("review_id", ids)
    .eq("locale", locale);

  const map = new Map((translations ?? []).map((t) => [t.review_id, t.comment]));
  const missing: T[] = [];

  const result = reviews.map((review) => {
    const translated = map.get(review.id);
    if (translated === undefined) {
      if (review.comment) missing.push(review);
      return review;
    }
    return { ...review, comment: translated };
  });

  if (missing.length > 0) {
    after(async () => {
      for (const review of missing) {
        await translateAndSaveReview(review.id, review.comment);
      }
    });
  }

  return result;
}
