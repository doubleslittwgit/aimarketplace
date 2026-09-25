"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { notify } from "@/lib/notifications/create";
import { courseNewReview } from "@/lib/notifications/content";

export type CourseReviewResult = { error: string } | { error: null };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 講座のレビューを投稿する（自分のレビューがあれば上書き）。
 *
 * 「誰が書けるか」（有料は購入者、無料はログイン中の人、作者本人は不可）は
 * データベースの can_review_course() と RLS が判定している。
 * ここではその結果を分かりやすいメッセージに置き換えるだけ。
 */
export async function upsertCourseReview(
  courseId: string,
  rating: number,
  comment: string
): Promise<CourseReviewResult> {
  const t = await getTranslations("academyCourse.reviews");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: t("errors.login") };
  if (!UUID.test(courseId)) return { error: t("errors.notAllowed") };
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { error: t("errors.rating") };

  const trimmed = String(comment ?? "").trim().slice(0, 1000) || null;

  const { data: existing } = await supabase
    .from("course_reviews")
    .select("id")
    .eq("course_id", courseId)
    .eq("user_id", user.id)
    .maybeSingle();

  const { error } = await supabase.from("course_reviews").upsert(
    {
      course_id: courseId,
      user_id: user.id,
      rating,
      comment: trimmed,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "course_id,user_id" }
  );
  if (error) {
    return {
      error: error.message.toLowerCase().includes("row-level security")
        ? t("errors.notAllowed")
        : t("errors.failed", { message: error.message }),
    };
  }

  const { data: course } = await supabase
    .from("courses")
    .select("slug, title, author_id")
    .eq("id", courseId)
    .maybeSingle();

  // 作者への通知は、新しくレビューが付いたときだけ（書き直しのたびには送らない）
  if (!existing && course && course.author_id !== user.id) {
    await notify(course.author_id, "new_review", (locale) =>
      courseNewReview(course.title, rating, course.slug, locale)
    );
  }

  if (course) {
    revalidatePath(`/academy/courses/${course.slug}`);
    revalidatePath("/academy");
  }
  return { error: null };
}

export async function deleteCourseReview(courseId: string): Promise<CourseReviewResult> {
  const t = await getTranslations("academyCourse.reviews");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: t("errors.login") };
  if (!UUID.test(courseId)) return { error: t("errors.notAllowed") };

  // 自分のレビューしか消せないことは RLS が保証している
  const { error } = await supabase
    .from("course_reviews")
    .delete()
    .eq("course_id", courseId)
    .eq("user_id", user.id);
  if (error) return { error: t("errors.failed", { message: error.message }) };

  const { data: course } = await supabase.from("courses").select("slug").eq("id", courseId).maybeSingle();
  if (course) {
    revalidatePath(`/academy/courses/${course.slug}`);
    revalidatePath("/academy");
  }
  return { error: null };
}
