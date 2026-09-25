"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isCourseCategory } from "@/lib/academy/categories";
import { slugify } from "@/lib/slugify";

/**
 * 公開後の講座に対する操作（作者本人のみ）。
 *
 * 方針: 公開後は本文・タイトル・サムネイル・返金ポリシーは変更できない。
 * 変更できるのは「価格（有料の範囲内）・カテゴリ・販売部数の上限」と「公開/非公開」だけで、
 * どちらも審査なしで即反映する（Brainの「クイック編集」と同じ考え方）。
 * 内容を直したい場合は、改訂版（複製）を作って改めて審査に出す。
 *
 * 同じ制限はデータベースのトリガー（supabase/academy_publish_lock.sql）でもかけている。
 */

type Result = { error: string } | { error: null };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MIN_PAID_PRICE = 100;
const MAX_PRICE = 100000;

async function loadOwnCourse(courseId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !UUID.test(courseId)) return { supabase, user: null, course: null };
  const { data: course } = await supabase
    .from("courses")
    .select("id, slug, author_id, status, price, title, thumbnail_url, category, refund_policy, toc, free_content, has_paid_part, sales_limit")
    .eq("id", courseId)
    .maybeSingle();
  if (!course || course.author_id !== user.id) return { supabase, user, course: null };
  return { supabase, user, course };
}

function revalidateCourse(slug: string, id: string) {
  revalidatePath(`/academy/courses/${slug}`);
  revalidatePath(`/academy/${id}/edit`);
  revalidatePath("/academy");
  revalidatePath("/dashboard");
}

/** 価格・カテゴリ・販売部数の上限を変更する（審査なし・即反映） */
export async function quickEditCourse(input: {
  courseId: string;
  price: number;
  category: string | null;
  salesLimit: number | null;
}): Promise<Result> {
  const t = await getTranslations("academyPublished.errors");
  const { supabase, user, course } = await loadOwnCourse(input.courseId);
  if (!user) return { error: t("login") };
  if (!course) return { error: t("notFound") };
  if (course.status !== "published" && course.status !== "suspended") return { error: t("notPublished") };

  const price = Math.round(Number(input.price));
  if (!Number.isFinite(price)) return { error: t("price") };
  if (course.price === 0) {
    if (price !== 0) return { error: t("freeToPaid") };
  } else {
    if (price === 0) return { error: t("paidToFree") };
    if (price < MIN_PAID_PRICE || price > MAX_PRICE) return { error: t("price") };
  }

  let salesLimit: number | null = null;
  if (input.salesLimit !== null && input.salesLimit !== undefined && String(input.salesLimit) !== "") {
    salesLimit = Math.round(Number(input.salesLimit));
    if (!Number.isFinite(salesLimit) || salesLimit < 1 || salesLimit > 100000) return { error: t("salesLimit") };
    const { data: sold } = await supabase.rpc("course_sold_count", { p_course_id: course.id });
    if (typeof sold === "number" && salesLimit < sold) return { error: t("salesLimitBelowSold", { n: sold }) };
  }
  // 無料講座には販売部数の上限を付けない（「売り切れ」で読めなくなる無料講座は分かりにくいため）
  if (course.price === 0) salesLimit = null;

  const { error } = await supabase
    .from("courses")
    .update({
      price,
      category: isCourseCategory(input.category) ? input.category : null,
      sales_limit: salesLimit,
    })
    .eq("id", course.id);
  if (error) return { error: t("failed", { message: error.message }) };

  revalidateCourse(course.slug, course.id);
  return { error: null };
}

/**
 * 公開 ⇔ 非公開を切り替える。
 * 非公開にしても、購入済みの人は引き続き読める（講座ページ・マイページから）。
 */
export async function setCourseVisibility(courseId: string, visible: boolean): Promise<Result> {
  const t = await getTranslations("academyPublished.errors");
  const { supabase, user, course } = await loadOwnCourse(courseId);
  if (!user) return { error: t("login") };
  if (!course) return { error: t("notFound") };
  if (course.status !== "published" && course.status !== "suspended") return { error: t("notPublished") };

  const { error } = await supabase
    .from("courses")
    .update({ status: visible ? "published" : "suspended" })
    .eq("id", course.id);
  if (error) return { error: t("failed", { message: error.message }) };

  revalidateCourse(course.slug, course.id);
  return { error: null };
}

/**
 * 改訂版（複製）を作る。
 * 本文・タイトル・サムネイル・価格などを引き継いだ新しい下書きを作り、その編集画面のIDを返す。
 * 画像は新しい講座のフォルダへコピーする（元の講座を後で削除しても、改訂版の画像が消えないように）。
 */
export async function duplicateCourse(courseId: string): Promise<{ error: string } | { error: null; id: string }> {
  const t = await getTranslations("academyPublished.errors");
  const { supabase, user, course } = await loadOwnCourse(courseId);
  if (!user) return { error: t("login") };
  if (!course) return { error: t("notFound") };

  const { data: body } = await supabase
    .from("course_bodies")
    .select("content")
    .eq("course_id", course.id)
    .maybeSingle();

  const newId = crypto.randomUUID();
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
  const publicPrefix = `${base}/storage/v1/object/public/tool-images/`;
  const oldFolder = `${user.id}/courses/${course.id}/`;
  const newFolder = `${user.id}/courses/${newId}/`;

  // 本文とサムネイルの中にある、元の講座フォルダの画像を新しいフォルダへコピーする
  let contentText = JSON.stringify(body?.content ?? { type: "doc", content: [] });
  let thumbnailUrl: string | null = course.thumbnail_url ?? null;
  const pattern = new RegExp(
    `${(publicPrefix + oldFolder).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^"'\\s)]+`,
    "g"
  );
  const urls = new Set<string>([...(contentText.match(pattern) ?? []), ...((thumbnailUrl ?? "").match(pattern) ?? [])]);
  if (urls.size > 0) {
    const storage = createAdminClient().storage.from("tool-images");
    for (const url of urls) {
      const fromPath = decodeURIComponent(url.slice(publicPrefix.length));
      if (!fromPath.startsWith(oldFolder)) continue;
      const toPath = newFolder + fromPath.slice(oldFolder.length);
      const { error: copyError } = await storage.copy(fromPath, toPath);
      if (copyError) return { error: t("imageCopyFailed", { message: copyError.message }) };
    }
    contentText = contentText.split(publicPrefix + oldFolder).join(publicPrefix + newFolder);
    if (thumbnailUrl) thumbnailUrl = thumbnailUrl.split(publicPrefix + oldFolder).join(publicPrefix + newFolder);
  }

  let slugBase = slugify(course.title || "course");
  if (slugBase === "tool") slugBase = "course";

  const { error: insertError } = await supabase.from("courses").insert({
    id: newId,
    slug: `${slugBase}-${newId.slice(0, 6)}`,
    author_id: user.id,
    title: course.title,
    thumbnail_url: thumbnailUrl,
    price: course.price,
    category: course.category,
    refund_policy: course.refund_policy,
    status: "draft",
    free_content: course.free_content,
    toc: course.toc,
    has_paid_part: course.has_paid_part,
    sales_limit: course.sales_limit,
  });
  if (insertError) return { error: t("failed", { message: insertError.message }) };

  const { error: bodyError } = await supabase
    .from("course_bodies")
    .insert({ course_id: newId, content: JSON.parse(contentText) });
  if (bodyError) return { error: t("failed", { message: bodyError.message }) };

  // 紐付けていたツールも引き継ぐ
  const { data: links } = await supabase.from("course_tool_links").select("tool_id").eq("course_id", course.id);
  if (links && links.length > 0) {
    await supabase.from("course_tool_links").insert(links.map((l) => ({ course_id: newId, tool_id: l.tool_id })));
  }

  revalidatePath("/dashboard");
  return { error: null, id: newId };
}
