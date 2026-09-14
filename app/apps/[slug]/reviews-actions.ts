"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "レビューを書くにはログインが必要です" };
  }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { error: "評価は1〜5の範囲で選んでください" };
  }

  const { error } = await supabase.from("reviews").upsert(
    {
      tool_id: toolId,
      author_id: user.id,
      rating,
      comment: comment.trim() || null,
    },
    { onConflict: "tool_id,author_id" }
  );

  if (error) {
    // RLSに弾かれた場合（＝購入していない）は、分かりやすいメッセージに置き換える
    const message = error.message.toLowerCase().includes("row-level security")
      ? "このツールを購入した方だけがレビューを書けます"
      : `投稿に失敗しました: ${error.message}`;
    return { error: message };
  }

  revalidatePath(`/apps/${slug}`);
  return { error: null };
}

export async function deleteReview(
  reviewId: string,
  slug: string
): Promise<ReviewActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "ログインが必要です" };
  }

  // 対象を自分の投稿に限定しているのはRLS（"users can delete own reviews"）。
  // ここでは追加の絞り込みはせず、DB側の判定に任せる。
  const { error } = await supabase.from("reviews").delete().eq("id", reviewId);

  if (error) {
    return { error: `削除に失敗しました: ${error.message}` };
  }

  revalidatePath(`/apps/${slug}`);
  return { error: null };
}
