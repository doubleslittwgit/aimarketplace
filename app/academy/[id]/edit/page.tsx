import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CourseComposer from "@/components/academy/CourseComposer";
import { getMyPublishedTools } from "@/app/feed/actions";
import type { JSONNode } from "@/lib/course-content";

export const metadata = { title: "講座を編集 | BuildBay Academy" };

export default async function EditCoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/academy/${id}/edit`);

  const { data: course } = await supabase
    .from("courses")
    .select("id, author_id, title, thumbnail_url, price, status")
    .eq("id", id)
    .maybeSingle();

  // 他人の講座の編集画面は、存在自体を教えない
  if (!course || course.author_id !== user.id) notFound();

  const [{ data: body }, { data: links }, myTools] = await Promise.all([
    // 全文（有料部分を含む）は金庫側にある。作者本人なので読める
    supabase.from("course_bodies").select("content").eq("course_id", id).maybeSingle(),
    supabase.from("course_tool_links").select("tool_id").eq("course_id", id),
    getMyPublishedTools(),
  ]);

  return (
    <CourseComposer
      courseId={course.id}
      userId={user.id}
      myTools={myTools}
      initial={{
        title: course.title,
        thumbnailUrl: course.thumbnail_url,
        price: course.price,
        content: (body?.content as JSONNode) ?? null,
        status: course.status,
        toolIds: (links ?? []).map((l) => l.tool_id),
      }}
    />
  );
}
