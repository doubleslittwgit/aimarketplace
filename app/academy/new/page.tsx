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

  const [myTools, { data: canReceive }] = await Promise.all([
    getMyPublishedTools(),
    supabase.rpc("seller_can_receive_payments", { p_user_id: user.id }),
  ]);

  return (
    <CourseComposer
      userId={user.id}
      myTools={myTools}
      canReceivePayments={Boolean(canReceive)}
      initial={{ title: "", thumbnailUrl: null, price: 0, category: null, content: null, status: "draft", toolIds: [] }}
    />
  );
}
