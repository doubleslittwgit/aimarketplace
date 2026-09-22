"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { notify } from "@/lib/notifications/create";
import { newReview } from "@/lib/notifications/content";
import { translateAndSaveReview } from "@/lib/translate-review";

export type ReviewActionResult = { error: string } | { error: null };

/**
 * レビューを投稿（または自分の既存レビューを上書き）する。
 *
 * 「購入した人だけが書ける」という制約は、このコードではなく
 * DB側のRLSポリシー（reviews_insert等）が保証している。
 * そのため、ここで改めて購入確認をしなくても安全（多層防御にはなっていないが、
 * DB側の制約が唯一の正、かつ最も信頼できる場所にある）。
 */
export async function upsertReview(
  toolId: string,
  slug: string,
  rating: number,
  comment: string
): Promise<ReviewActionResult> {
  const t = await getTranslations("errors");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: t("reviewLoginRequired") };
  }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { error: t("ratingRangeInvalid") };
  }

  // 新規投稿か上書き編集かを先に判定しておく。
  // 出品者への通知は「新しいレビューがついた」ことを知らせるものなので、
  // 星の数を書き直しただけの編集では、毎回は送らない。
  const { data: existing } = await supabase
    .from("reviews")
    .select("id")
    .eq("tool_id", toolId)
    .eq("author_id", user.id)
    .maybeSingle();
  const isNewReview = !existing;

  const trimmedComment = comment.trim() || null;

  const { data: savedReview, error } = await supabase
    .from("reviews")
    .upsert(
      {
        tool_id: toolId,
        author_id: user.id,
        rating,
        comment: trimmedComment,
      },
      { onConflict: "tool_id,author_id" }
    )
    .select("id")
    .single();

  if (error) {
    // RLSに弾かれた場合（＝購入していない）は、分かりやすいメッセージに置き換える
    const message = error.message.toLowerCase().includes("row-level security")
      ? t("reviewRequiresPurchase")
      : t("postFailed", { message: error.message });
    return { error: message };
  }

  if (savedReview) {
    after(() => translateAndSaveReview(savedReview.id, trimmedComment));
  }

  if (isNewReview) {
    const { data: tool } = await supabase
      .from("tools")
      .select("name, author_id")
      .eq("id", toolId)
      .maybeSingle();

    // 自分の購入したツールに自分でレビューは書けない設計だが、
    // 念のため出品者本人には通知しない分岐を入れておく
    if (tool && tool.author_id !== user.id) {
      await notify(tool.author_id, "new_review", (locale) => newReview(tool.name, rating, slug, locale));
    }
  }

  revalidatePath(`/apps/${slug}`);
  return { error: null };
}

export async function deleteReview(
  reviewId: string,
  slug: string
): Promise<ReviewActionResult> {
  const t = await getTranslations("errors");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: t("loginRequired") };
  }

  // 対象を自分の投稿に限定しているのはRLS（"users can delete own reviews"）。
  // ここでは追加の絞り込みはせず、DB側の判定に任せる。
  const { error } = await supabase.from("reviews").delete().eq("id", reviewId);

  if (error) {
    return { error: t("deleteFailed", { message: error.message }) };
  }

  revalidatePath(`/apps/${slug}`);
  return { error: null };
}
