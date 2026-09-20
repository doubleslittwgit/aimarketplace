"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";

export type FollowResult = { error: string | null; following: boolean };

/**
 * フォロー状態を切り替える。
 * 既にフォロー済みなら解除、そうでなければフォローする。
 */
export async function toggleFollow(
  targetHandle: string,
  targetProfileId: string
): Promise<FollowResult> {
  const t = await getTranslations("errors");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: t("loginRequired"), following: false };
  }

  if (user.id === targetProfileId) {
    // 自分自身はフォローできない（UI側でもボタンを出さないが、念のため二重に防ぐ）
    return { error: null, following: false };
  }

  const { data: existing } = await supabase
    .from("follows")
    .select("follower_id")
    .eq("follower_id", user.id)
    .eq("following_id", targetProfileId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("follows")
      .delete()
      .eq("follower_id", user.id)
      .eq("following_id", targetProfileId);

    if (error) return { error: t("updateFailed", { message: error.message }), following: true };

    revalidatePath(`/u/${targetHandle}`);
    return { error: null, following: false };
  }

  const { error } = await supabase
    .from("follows")
    .insert({ follower_id: user.id, following_id: targetProfileId });

  if (error) return { error: t("updateFailed", { message: error.message }), following: false };

  revalidatePath(`/u/${targetHandle}`);
  return { error: null, following: true };
}
