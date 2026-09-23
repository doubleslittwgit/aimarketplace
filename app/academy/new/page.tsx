import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CourseComposer from "@/components/academy/CourseComposer";
import { getMyPublishedTools } from "@/app/feed/actions";

export const metadata = { title: "講座を作成 | BuildBay Academy" };

export default async function NewCoursePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/academy/new");

  const myTools = await getMyPublishedTools();

  return (
    <CourseComposer
      userId={user.id}
      myTools={myTools}
      initial={{ title: "", thumbnailUrl: null, price: 0, content: null, status: "draft", toolIds: [] }}
    />
  );
}
