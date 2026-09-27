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
  toolUpdated,
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

/**
 * 承認する。
 * 管理者が確認した時点のファイル・URL（seen）を受け取り、今の内容と一致するときだけ承認する。
 * 確認している間に出品者が差し替えていた場合に、見ていない内容を承認してしまわないため。
 * 承認した内容は「承認済み」として保存し、購入者にはそれだけが渡る
 * （app/apps/download/[toolId]/route.ts）。
 */
export async function approveTool(
  toolId: string,
  seen?: { fileKey: string | null; url: string | null; updatedAt?: string | null }
): Promise<ReviewActionResult> {
  const tAdmin = await getTranslations("admin");
  const { error: authError, userId } = await requireAdmin();
  if (authError) return { error: authError };

  const admin = createAdminClient();
  const [{ data: current }, { data: access }] = await Promise.all([
    admin.from("tools").select("file_key, approved_file_key, status, updated_at").eq("id", toolId).maybeSingle(),
    admin.from("tool_access_urls").select("url").eq("tool_id", toolId).maybeSingle(),
  ]);
  if (!current) return { error: tAdmin("approveFailed", { message: "not found" }) };
  if (current.status !== "pending_review") {
    return { error: tAdmin("approveFailed", { message: "審査待ちではありません（再読み込みしてください）" }) };
  }
  // ファイル・URLに加えて、最終更新日時でサムネイルや説明文などの差し替えも検知する
  const changedSinceSeen =
    seen &&
    ((seen.fileKey ?? null) !== (current.file_key ?? null) ||
      (seen.url ?? null) !== (access?.url ?? null) ||
      (seen.updatedAt != null &&
        new Date(seen.updatedAt).getTime() !== new Date(current.updated_at).getTime()));
  if (changedSinceSeen) {
    return {
      error: tAdmin("approveFailed", {
        message: "確認している間に出品者が内容を変更しました。再読み込みして、もう一度確認してください",
      }),
    };
  }

  const { data: tool, error } = await admin
    .from("tools")
    .update({
      status: "published",
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
      rejection_reason: null,
      approved_file_key: current.file_key,
    })
    .eq("id", toolId)
    .eq("status", "pending_review")
    .select("id, name, tagline, description, slug, author_id")
    .maybeSingle();

  if (error) return { error: tAdmin("approveFailed", { message: error.message }) };
  // 同じ瞬間に出品者が取り下げた等で、承認の対象が無くなっていた
  if (!tool) {
    return { error: tAdmin("approveFailed", { message: "審査待ちではなくなりました（再読み込みしてください）" }) };
  }

  if (access?.url) {
    const { error: urlError } = await admin
      .from("tool_access_urls")
      .update({ approved_url: access.url })
      .eq("tool_id", toolId);
    if (urlError) return { error: tAdmin("approveFailed", { message: urlError.message }) };
  }

  await notify(tool.author_id, "tool_approved", (locale) => toolApproved(tool.name, tool.slug, locale));
  // 公開直後の最初の訪問者を待たせないよう、この場で翻訳しておく
  // （閲覧時にも無ければ翻訳する仕組みがあるので、ここが失敗しても実害は無い）。
  after(() => translateAndSaveTool(tool.id, tool.name, tool.tagline, tool.description));

  // 公開済みのツールのファイルが差し替えられていた場合、承認したこの時点で初めて購入者が
  // 新しいファイルを受け取れるようになるので、ここで購入者に更新を知らせる
  const previousApproved = current.approved_file_key;
  if (previousApproved && current.file_key && previousApproved !== current.file_key) {
    after(async () => {
      const { data: latest } = await admin
        .from("tool_versions")
        .select("version, changelog")
        .eq("tool_id", tool.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!latest?.version || !latest.changelog) return;
      const { data: buyers } = await admin
        .from("purchases")
        .select("buyer_id")
        .eq("tool_id", tool.id)
        .eq("status", "completed");
      const unique = Array.from(new Set((buyers ?? []).map((b) => b.buyer_id))).filter(
        (id) => id !== tool.author_id
      );
      for (const buyerId of unique) {
        await notify(buyerId, "tool_updated", (locale) =>
          toolUpdated(tool.name, tool.slug, latest.version, latest.changelog, locale)
        );
      }
    });
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
    await notify(tool.author_id, "tool_rejected", (locale) => toolRejected(tool.name, reason.trim(), locale));
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
    (locale) => toolUnpublishedByAdminContent(tool.name, reason.trim(), locale)
  );

  revalidatePath("/admin/review");
  revalidatePath("/dashboard");
  return { error: null };
}
