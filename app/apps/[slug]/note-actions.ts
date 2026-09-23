"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";

export type NoteActionResult = { error: string | null };

const MAX_LENGTH = 1000;

/**
 * ツールの「使い方のコツ」を投稿する。
 *
 * レビュー（★評価）とは別枠。レビューは「良し悪しの評価」だが、
 * こちらは「使いこなすための実用的な知識」を貯めるためのもの。
 * 評価と混ぜると、どちらの目的も果たせなくなるため分けている。
 *
 * 購入者・無料ツールの利用者、どちらも書ける。
 */
export async function addToolNote(
  toolId: string,
  slug: string,
  content: string
): Promise<NoteActionResult> {
  const t = await getTranslations("errors");
  const tNote = await getTranslations("toolNotes");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: t("submitLoginRequired") };

  const trimmed = content.trim();
  if (!trimmed) return { error: tNote("contentRequired") };
  if (trimmed.length > MAX_LENGTH) return { error: tNote("tooLong") };

  const { error } = await supabase.from("tool_notes").insert({
    tool_id: toolId,
    author_id: user.id,
    content: trimmed,
  });

  if (error) return { error: t("saveFailed", { message: error.message }) };

  revalidatePath(`/apps/${slug}`);
  return { error: null };
}

/** 自分が書いたコツを削除する */
export async function deleteToolNote(
  noteId: string,
  slug: string
): Promise<NoteActionResult> {
  const t = await getTranslations("errors");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: t("submitLoginRequired") };

  // RLSでも自分の投稿しか削除できないが、明示的に条件を書いておく
  const { error } = await supabase
    .from("tool_notes")
    .delete()
    .eq("id", noteId)
    .eq("author_id", user.id);

  if (error) return { error: t("saveFailed", { message: error.message }) };

  revalidatePath(`/apps/${slug}`);
  return { error: null };
}
