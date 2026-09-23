import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Academy の講座用フォルダに残った、使われていない画像を削除する。
 *
 * 画像は本文やサムネイルに入れた瞬間にアップロードされるため、
 *   ・書きかけのまま保存されなかった
 *   ・サムネイルを差し替えた／本文から画像を消した
 * といった場合に、どこからも使われない画像がストレージに残り続けてしまう。
 *
 * 一覧はデータベースの関数（list_unused_course_images）で出し、削除はストレージのAPIで行う
 * （データベースから直接消すとファイル本体が残るため、Supabase側で禁止されている）。
 * 必ず管理者権限のクライアントで呼ぶこと。
 */
export async function removeUnusedCourseImages(
  admin: SupabaseClient,
  opts: {
    /** これより新しい画像は消さない（書いている途中の画像を守るため） */
    minAge: string;
    /** 指定すると、その講座のフォルダだけを対象にする */
    courseId?: string;
  }
): Promise<{ removed: number; bytes: number; error: string | null }> {
  const { data, error } = await admin.rpc("list_unused_course_images", { p_min_age: opts.minAge });
  if (error) return { removed: 0, bytes: 0, error: error.message };

  const rows = ((data ?? []) as { name: string; bytes: number }[]).filter(
    (r) => !opts.courseId || r.name.split("/")[2] === opts.courseId
  );
  if (rows.length === 0) return { removed: 0, bytes: 0, error: null };

  let removed = 0;
  let bytes = 0;
  // 一度に大量に消さないよう、100件ずつ
  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100);
    const { error: removeError } = await admin.storage.from("tool-images").remove(batch.map((r) => r.name));
    if (removeError) return { removed, bytes, error: removeError.message };
    removed += batch.length;
    bytes += batch.reduce((s, r) => s + Number(r.bytes || 0), 0);
  }
  return { removed, bytes, error: null };
}
