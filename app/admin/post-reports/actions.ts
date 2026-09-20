"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const };

  const { data: isAdminData } = await supabase.rpc("is_admin", {
    p_user_id: user.id,
  });
  return { ok: Boolean(isAdminData) };
}

export async function updatePostReportStatus(
  reportId: string,
  status: "reviewed" | "dismissed"
): Promise<{ error: string | null }> {
  const tAdmin = await getTranslations("admin");
  const { ok } = await requireAdmin();
  if (!ok) return { error: tAdmin("noAdminPermission") };

  const admin = createAdminClient();
  const { error } = await admin
    .from("post_reports")
    .update({ status })
    .eq("id", reportId);

  if (error) return { error: error.message };

  revalidatePath("/admin/post-reports");
  return { error: null };
}

/**
 * 通報された投稿そのものを削除する。同時に、この投稿に対する
 * 未対応の通報はまとめて「対応済み」にしておく。
 */
export async function deleteReportedPost(
  postId: string
): Promise<{ error: string | null }> {
  const tAdmin = await getTranslations("admin");
  const tErrors = await getTranslations("errors");
  const { ok } = await requireAdmin();
  if (!ok) return { error: tAdmin("noAdminPermission") };

  const admin = createAdminClient();
  const { error: deleteError } = await admin.from("posts").delete().eq("id", postId);
  if (deleteError) return { error: tErrors("deleteFailed", { message: deleteError.message }) };

  await admin
    .from("post_reports")
    .update({ status: "reviewed" })
    .eq("post_id", postId)
    .eq("status", "open");

  revalidatePath("/admin/post-reports");
  return { error: null };
}
