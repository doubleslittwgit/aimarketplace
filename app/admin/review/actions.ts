"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/notifications/create";
import { translateAndSaveTool } from "@/lib/translate-tool";
import {
  toolApproved,
  toolRejected,
  toolUnpublishedByAdmin as toolUnpublishedByAdminContent,
} from "@/lib/notifications/content";

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
  const { data: tool, error } = await admin
    .from("tools")
    .update({
      status: "published",
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
      rejection_reason: null,
    })
    .eq("id", toolId)
    .select("id, name, tagline, description, slug, author_id")
    .maybeSingle();

  if (error) return { error: `承認に失敗しました: ${error.message}` };

  if (tool) {
    await notify(tool.author_id, "tool_approved", toolApproved(tool.name, tool.slug));
    // 公開直後の最初の訪問者を待たせないよう、この場で翻訳しておく
    // （閲覧時にも無ければ翻訳する仕組みがあるので、ここが失敗しても実害は無い）。
    after(() => translateAndSaveTool(tool.id, tool.name, tool.tagline, tool.description));
  }

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
  const { data: tool, error } = await admin
    .from("tools")
    .update({
      status: "rejected",
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
      rejection_reason: reason.trim(),
    })
    .eq("id", toolId)
    .select("id, name, author_id")
    .maybeSingle();

  if (error) return { error: `却下に失敗しました: ${error.message}` };

  if (tool) {
    await notify(tool.author_id, "tool_rejected", toolRejected(tool.name, reason.trim()));
  }

  revalidatePath("/admin/review");
  return { error: null };
}

/**
 * 既に公開済みのツールを、管理者が理由付きで非公開にする。
 * 出品者本人による非公開化（edit画面）とは別の経路。
 * rejection_reason 列を再利用しており、「suspended かつ
 * rejection_reason がある」＝管理者による非公開、という区別にしている。
 */
export async function unpublishToolByAdmin(
  toolId: string,
  reason: string
): Promise<ReviewActionResult> {
  const { error: authError, userId } = await requireAdmin();
  if (authError) return { error: authError };

  if (!reason.trim()) {
    return { error: "非公開にする理由を入力してください（出品者に表示されます）" };
  }

  const admin = createAdminClient();
  const { data: tool, error } = await admin
    .from("tools")
    .update({
      status: "suspended",
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
      rejection_reason: reason.trim(),
    })
    .eq("id", toolId)
    .eq("status", "published")
    .select("id, name, author_id")
    .maybeSingle();

  if (error) return { error: `非公開化に失敗しました: ${error.message}` };
  if (!tool) return { error: "対象のツールが見つかりません（既に非公開の可能性があります）" };

  await notify(
    tool.author_id,
    "tool_unpublished_by_admin",
    toolUnpublishedByAdminContent(tool.name, reason.trim())
  );

  revalidatePath("/admin/review");
  revalidatePath("/dashboard");
  return { error: null };
}
