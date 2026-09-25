import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CourseComposer from "@/components/academy/CourseComposer";
import PublishedCoursePanel from "@/components/academy/PublishedCoursePanel";
import { getMyPublishedTools } from "@/app/feed/actions";
import type { JSONNode } from "@/lib/course-content";

export const metadata = { title: "講座を編集 | BuildBay Academy" };

export default async function EditCoursePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ submitted?: string }>;
}) {
  const { id } = await params;
  const justSubmitted = (await searchParams).submitted === "1";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/academy/${id}/edit`);

  const { data: course } = await supabase
    .from("courses")
    .select("id, slug, author_id, title, thumbnail_url, price, status, category, refund_policy, sales_limit, updated_at")
    .eq("id", id)
    .maybeSingle();

  // 他人の講座の編集画面は、存在自体を教えない
  if (!course || course.author_id !== user.id) notFound();

  // 公開後は本文を編集できない。価格などの変更・公開/非公開・改訂版の作成だけができる管理画面を出す
  if (course.status === "published" || course.status === "suspended") {
    const { data: sold } = await supabase.rpc("course_sold_count", { p_course_id: course.id });
    return (
      <PublishedCoursePanel
        soldCount={typeof sold === "number" ? sold : 0}
        course={{
          id: course.id,
          slug: course.slug,
          title: course.title,
          thumbnailUrl: course.thumbnail_url,
          price: course.price,
          category: course.category,
          salesLimit: course.sales_limit,
          status: course.status,
        }}
      />
    );
  }

  const [{ data: body }, { data: links }, myTools, { data: canReceive }] = await Promise.all([
    // 全文（有料部分を含む）は金庫側にある。作者本人なので読める
    supabase.from("course_bodies").select("content").eq("course_id", id).maybeSingle(),
    supabase.from("course_tool_links").select("tool_id").eq("course_id", id),
    getMyPublishedTools(),
    supabase.rpc("seller_can_receive_payments", { p_user_id: user.id }),
  ]);

  return (
    <CourseComposer
      courseId={course.id}
      userId={user.id}
      myTools={myTools}
      canReceivePayments={Boolean(canReceive)}
      celebrateOnMount={justSubmitted}
      initial={{
        title: course.title,
        thumbnailUrl: course.thumbnail_url,
        price: course.price,
        category: course.category,
        refundPolicy: course.refund_policy,
        salesLimit: course.sales_limit,
        savedAt: course.updated_at,
        content: (body?.content as JSONNode) ?? null,
        status: course.status,
        toolIds: (links ?? []).map((l) => l.tool_id),
      }}
    />
  );
}
