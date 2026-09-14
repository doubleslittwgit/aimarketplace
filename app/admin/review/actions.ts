"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type ReviewActionResult = { error: string } | { error: null };

/**
 * 呼び出し元が管理者かどうかを確認する。
 * 管理者判定は is_admin()（security definer関数）を、
 * 呼び出したユーザー自身のセッションで実行するので安全
 * （他人の管理者権限を勝手に確認・詐称することはできない）。
 */
async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "ログインが必要です" as const, userId: null };

  const { data: isAdminData } = await supabase.rpc("is_admin", {
    p_user_id: user.id,
  });
  if (!isAdminData) return { error: "管理者権限がありません" as const, userId: null };

  return { error: null, userId: user.id };
}

export async function approveTool(toolId: string): Promise<ReviewActionResult> {
  const { error: authError, userId } = await requireAdmin();
  if (authError) return { error: authError };

  const admin = createAdminClient();
  const { error } = await admin
    .from("tools")
    .update({
      status: "published",
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
      rejection_reason: null,
    })
    .eq("id", toolId);

  if (error) return { error: `承認に失敗しました: ${error.message}` };

  revalidatePath("/admin/review");
  return { error: null };
}

export async function rejectTool(
  toolId: string,
  reason: string
): Promise<ReviewActionResult> {
  const { error: authError, userId } = await requireAdmin();
  if (authError) return { error: authError };

  if (!reason.trim()) {
    return { error: "却下理由を入力してください（出品者に表示されます）" };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("tools")
    .update({
      status: "rejected",
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
      rejection_reason: reason.trim(),
    })
    .eq("id", toolId);

  if (error) return { error: `却下に失敗しました: ${error.message}` };

  revalidatePath("/admin/review");
  return { error: null };
}
