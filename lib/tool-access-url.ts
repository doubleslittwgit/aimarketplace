import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * クラウド型ツールの「ツールのURL（本番の入口）」を保存・削除する。
 *
 * 【なぜ tools テーブルとは別の場所に置くのか】
 * tools は公開中なら誰でも読める（商品一覧のため）。そこにURLを置くと、
 * 画面に表示しなくても、公開鍵でデータベースに直接問い合わせれば
 * 購入していない人でも読めてしまう。
 * tool_access_urls は「出品者本人・購入済みの人・無料ツールなら誰でも」しか
 * 読めないようデータベース側で制限しているので、直接問い合わせても漏れない。
 *
 * クラウド型でない（ローカル型の）ツールや、URLが空の場合は行を消す。
 */
export async function syncToolAccessUrl(
  supabase: SupabaseClient,
  toolId: string,
  runtime: string,
  url: string | null
): Promise<string | null> {
  if (runtime === "cloud" && url) {
    const { error } = await supabase
      .from("tool_access_urls")
      .upsert(
        { tool_id: toolId, url, updated_at: new Date().toISOString() },
        { onConflict: "tool_id" }
      );
    return error?.message ?? null;
  }
  const { error } = await supabase.from("tool_access_urls").delete().eq("tool_id", toolId);
  return error?.message ?? null;
}

/** ツールのURLとして受け付ける形式（http/https のみ） */
export function isValidToolUrl(url: string): boolean {
  return /^https?:\/\/[^\s]+$/i.test(url);
}
