"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 退会（アカウント削除）。
 *
 * 方針:
 *   - 名前・メールアドレス・プロフィール・投稿・レビューなどの個人情報は消す
 *   - 購入・売上・送金・チップの記録は、法令上の保存義務と紛争対応のため、
 *     個人を特定できない形（退会したユーザー）で残す
 *   - 出品中のツール・講座は非公開にする（購入済みの人は引き続き利用できる）
 *
 * 購入記録は profiles を参照していて（削除すると連鎖で消える／削除できない）、
 * プロフィールの行そのものは消さずに中身を空にする。ログイン情報（メールアドレス等）は
 * Supabase Auth の「論理削除」で消す（行は残るが、メールアドレス等は復元できない形になり、ログインできなくなる）。
 */
export async function deleteAccount(formData: FormData): Promise<{ error: string | null }> {
  const t = await getTranslations("accountSettings.errors");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: t("login") };

  // 誤操作防止: 自分のメールアドレスを入力してもらう
  const typed = String(formData.get("confirmEmail") || "").trim().toLowerCase();
  if (!user.email || typed !== user.email.toLowerCase()) return { error: t("emailMismatch") };

  const admin = createAdminClient();

  // 運営者（管理者）は、ここからは退会できない（管理者がいなくなるのを防ぐ）
  const { data: isAdmin } = await admin.from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (isAdmin) return { error: t("adminCannotDelete") };

  const uid = user.id;

  // 1. 出品中のツール・講座を非公開にする（審査中のものも取り下げる）
  const [{ error: toolsError }, { error: coursesError }] = await Promise.all([
    admin.from("tools").update({ status: "suspended" }).eq("author_id", uid).in("status", ["published", "pending_review"]),
    admin.from("courses").update({ status: "suspended" }).eq("author_id", uid).in("status", ["published", "pending_review"]),
  ]);
  if (toolsError || coursesError) {
    return { error: t("failed", { message: (toolsError ?? coursesError)!.message }) };
  }

  // 2. 本人が書いた・残した個人的な内容を消す（取引の記録は消さない）
  const deletions: [string, string][] = [
    ["posts", "author_id"],
    ["post_comments", "author_id"],
    ["post_likes", "user_id"],
    ["post_reports", "reporter_id"],
    ["follows", "follower_id"],
    ["follows", "following_id"],
    ["reviews", "author_id"],
    ["course_reviews", "user_id"],
    ["course_progress", "user_id"],
    ["tool_likes", "user_id"],
    ["tool_questions", "asker_id"],
    ["tool_notes", "author_id"],
    ["tool_reports", "reporter_id"],
    ["tool_requests", "requester_id"],
    ["tool_request_upvotes", "user_id"],
    ["tool_request_links", "linked_by"],
    ["seller_announcements", "author_id"],
    ["notifications", "user_id"],
  ];
  for (const [table, column] of deletions) {
    const { error } = await admin.from(table).delete().eq(column, uid);
    if (error) return { error: t("failed", { message: `${table}: ${error.message}` }) };
  }

  // 購入後の受け取り記録は、取引の証拠として日時だけ残し、IPアドレス・ブラウザの情報は消す
  const { error: logError } = await admin
    .from("purchase_access_logs")
    .update({ ip: null, user_agent: null })
    .eq("user_id", uid);
  if (logError) return { error: t("failed", { message: `purchase_access_logs: ${logError.message}` }) };

  // 3. プロフィール画像を消す（本人のフォルダの画像のうち、プロフィール画像だけ）
  const { data: profile } = await admin.from("profiles").select("avatar_url").eq("id", uid).maybeSingle();
  const marker = "/storage/v1/object/public/tool-images/";
  if (profile?.avatar_url?.includes(marker)) {
    const path = decodeURIComponent(profile.avatar_url.split(marker)[1] ?? "");
    if (path.startsWith(`${uid}/`)) await admin.storage.from("tool-images").remove([path]);
  }

  // 4. プロフィールを「退会したユーザー」にする（行は取引記録の参照先として残す）
  const { error: profileError } = await admin
    .from("profiles")
    .update({
      display_name: "退会したユーザー",
      handle: `deleted-${uid.replace(/-/g, "").slice(0, 12)}`,
      bio: null,
      avatar_url: null,
      notification_prefs: {},
      is_verified_seller: false,
    })
    .eq("id", uid);
  if (profileError) return { error: t("failed", { message: profileError.message }) };

  // 5. ログイン情報を消す。先にGoogleなどから受け取った名前・画像の情報を空にしてから、
  //    論理削除する（メールアドレス等は復元できない形になり、ログインできなくなる）
  await admin.auth.admin.updateUserById(uid, {
    user_metadata: {
      full_name: null,
      name: null,
      display_name: null,
      avatar_url: null,
      picture: null,
      email: null,
      preferred_username: null,
      user_name: null,
    },
  });
  const { error: authError } = await admin.auth.admin.deleteUser(uid, true);
  if (authError) return { error: t("failed", { message: authError.message }) };

  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/?accountDeleted=1");
}
