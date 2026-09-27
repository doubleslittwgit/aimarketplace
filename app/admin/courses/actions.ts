"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/notifications/create";
import { courseApproved, courseRejected, courseUnpublishedByAdmin } from "@/lib/notifications/content";
import { COURSE_PURCHASE_ENABLED } from "@/lib/academy/flags";
import { removeUnusedCourseImages } from "@/lib/academy/cleanup";

async function requireAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase.rpc("is_admin", { p_user_id: user.id });
  return Boolean(data);
}

/**
 * 講座を承認して公開する。
 * 作者が自分で「公開」にすることはデータベース側で禁止しているため、
 * 公開は必ずこの管理者権限の処理を通る。
 */
export async function approveCourse(courseId: string): Promise<{ error: string | null }> {
  if (!(await requireAdmin())) return { error: "管理者権限がありません" };
  const admin = createAdminClient();

  const { data: course } = await admin
    .from("courses")
    .select("id, title, slug, price, status, author_id")
    .eq("id", courseId)
    .maybeSingle();
  if (!course) return { error: "講座が見つかりません" };
  if (course.status !== "pending_review") return { error: "審査待ちの講座ではありません" };

  // 購入機能が完成するまでは、有料講座を公開しない（買えない講座が並ぶのを防ぐ）
  if (course.price > 0 && !COURSE_PURCHASE_ENABLED) {
    return { error: "有料講座の購入機能がまだ完成していないため、有料講座は公開できません" };
  }

  const { error } = await admin
    .from("courses")
    .update({ status: "published", published_at: new Date().toISOString(), rejection_reason: null })
    .eq("id", courseId);
  if (error) return { error: error.message };

  await notify(course.author_id, "course_approved", (locale) =>
    courseApproved(course.title, course.slug, locale)
  );
  revalidatePath("/admin/courses");
  revalidatePath("/academy");
  return { error: null };
}

/** 講座を差し戻す（理由は作者に通知される） */
export async function rejectCourse(courseId: string, reason: string): Promise<{ error: string | null }> {
  if (!(await requireAdmin())) return { error: "管理者権限がありません" };
  const trimmed = reason.trim();
  if (!trimmed) return { error: "差し戻しの理由を入力してください" };
  const admin = createAdminClient();

  const { data: course } = await admin
    .from("courses")
    .select("id, title, status, author_id")
    .eq("id", courseId)
    .maybeSingle();
  if (!course) return { error: "講座が見つかりません" };
  if (course.status !== "pending_review") return { error: "審査待ちの講座ではありません" };

  const { error } = await admin
    .from("courses")
    .update({ status: "rejected", rejection_reason: trimmed.slice(0, 1000) })
    .eq("id", courseId);
  if (error) return { error: error.message };

  await notify(course.author_id, "course_rejected", (locale) =>
    courseRejected(course.title, course.id, trimmed, locale)
  );
  revalidatePath("/admin/courses");
  return { error: null };
}

/**
 * 公開中（または作者が非公開にしている）講座を、運営として非公開にする。
 * 理由は作者に通知される。作者は自分で公開に戻せない（データベース側でも禁止）。
 * 購入済みの人は、引き続き講座を読める（返金するかどうかは別途判断する）。
 */
export async function unpublishCourseByAdmin(courseId: string, reason: string): Promise<{ error: string | null }> {
  if (!(await requireAdmin())) return { error: "管理者権限がありません" };
  const trimmed = reason.trim();
  if (!trimmed) return { error: "非公開にする理由を入力してください" };
  const admin = createAdminClient();

  const { data: course } = await admin
    .from("courses")
    .select("id, title, slug, status, author_id")
    .eq("id", courseId)
    .maybeSingle();
  if (!course) return { error: "講座が見つかりません" };
  if (course.status !== "published" && course.status !== "suspended") {
    return { error: "公開中の講座ではありません" };
  }

  const { error } = await admin
    .from("courses")
    .update({ status: "suspended", rejection_reason: trimmed.slice(0, 1000) })
    .eq("id", courseId);
  if (error) return { error: error.message };

  await notify(course.author_id, "course_unpublished_by_admin", (locale) =>
    courseUnpublishedByAdmin(course.title, trimmed, locale)
  );
  revalidatePath("/admin/courses");
  revalidatePath("/academy");
  revalidatePath(`/academy/courses/${course.slug}`);
  return { error: null };
}

/**
 * 保存されずに放置された書きかけなどの、使われていない講座画像をまとめて削除する。
 * 1時間以内の画像は、今まさに誰かが書いている途中の可能性があるので残す。
 */
export async function cleanupUnusedCourseImages(): Promise<{
  error: string | null;
  removed: number;
  bytes: number;
}> {
  if (!(await requireAdmin())) return { error: "管理者権限がありません", removed: 0, bytes: 0 };
  const result = await removeUnusedCourseImages(createAdminClient(), { minAge: "1 hour" });
  revalidatePath("/admin");
  return result;
}
