"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type LikeResult =
  | { ok: true; liked: boolean; likeCount: number }
  | { ok: false; error: string; needsLogin?: boolean };

/**
 * ツールへの「いいね」を切り替える。
 *
 * 【安全性について】
 * "use server" のエクスポートは誰でも叩けるHTTPエンドポイントになるため、
 * 「誰の操作か」を引数で受け取ってはいけない。必ずセッションから確定させる。
 * ここで受け取るのは対象ツールのIDのみ。
 *
 * 件数は tools.like_count をトリガーが自動更新するため、
 * アプリ側からは書き込まない（書けるようにすると数字を盛れてしまう）。
 */
export async function toggleLike(toolId: string): Promise<LikeResult> {
  if (!toolId) {
    return { ok: false, error: "対象のツールが指定されていません" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      error: "いいねするにはログインが必要です",
      needsLogin: true,
    };
  }

  // 現在いいね済みかを確認する
  const { data: existing, error: lookupError } = await supabase
    .from("tool_likes")
    .select("tool_id")
    .eq("tool_id", toolId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (lookupError) {
    return { ok: false, error: "状態の取得に失敗しました" };
  }

  let liked: boolean;

  if (existing) {
    const { error } = await supabase
      .from("tool_likes")
      .delete()
      .eq("tool_id", toolId)
      .eq("user_id", user.id);

    if (error) {
      return { ok: false, error: "いいねの取り消しに失敗しました" };
    }
    liked = false;
  } else {
    const { error } = await supabase
      .from("tool_likes")
      .insert({ tool_id: toolId, user_id: user.id });

    if (error) {
      // 素早く二度押しされて主キー重複になった場合は、
      // 結果としていいね済みなので成功扱いにする
      if (error.code === "23505") {
        liked = true;
      } else {
        return { ok: false, error: "いいねに失敗しました" };
      }
    } else {
      liked = true;
    }
  }

  // トリガー更新後の件数を読み直す
  const { data: tool } = await supabase
    .from("tools")
    .select("like_count, slug")
    .eq("id", toolId)
    .maybeSingle();

  if (tool?.slug) {
    revalidatePath(`/apps/${tool.slug}`);
  }

  return { ok: true, liked, likeCount: tool?.like_count ?? 0 };
}
