"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { getTranslations } from "next-intl/server";
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
  const t = await getTranslations("errors");
  const tAdmin = await getTranslations("admin");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: t("loginRequired") as string, userId: null };

  const { data: isAdminData } = await supabase.rpc("is_admin", {
    p_user_id: user.id,
  });
  if (!isAdminData) return { error: tAdmin("noAdminPermission") as string, userId: null };

  return { error: null, userId: user.id };
}

export async function approveTool(toolId: string): Promise<ReviewActionResult> {
  const tAdmin = await getTranslations("admin");
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

  if (error) return { error: tAdmin("approveFailed", { message: error.message }) };

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
  const tAdmin = await getTranslations("admin");
  const { error: authError, userId } = await requireAdmin();
  if (authError) return { error: authError };

  if (!reason.trim()) {
    return { error: tAdmin("rejectReasonRequired") };
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

  if (error) return { error: tAdmin("rejectFailed", { message: error.message }) };

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
  const tAdmin = await getTranslations("admin");
  const { error: authError, userId } = await requireAdmin();
  if (authError) return { error: authError };

  if (!reason.trim()) {
    return { error: tAdmin("unpublishReasonRequired") };
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

  if (error) return { error: tAdmin("unpublishFailed", { message: error.message }) };
  if (!tool) return { error: tAdmin("targetToolNotFoundMaybeUnpublished") };

  await notify(
    tool.author_id,
    "tool_unpublished_by_admin",
    toolUnpublishedByAdminContent(tool.name, reason.trim())
  );

  revalidatePath("/admin/review");
  revalidatePath("/dashboard");
  return { error: null };
}
