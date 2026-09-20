import { redirect } from "next/navigation";
import Header from "@/components/Header";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import PostReportsClient from "./PostReportsClient";

export const metadata = { title: "投稿の通報を確認" };

export default async function AdminPostReportsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/admin/post-reports");

  const { data: isAdminData } = await supabase.rpc("is_admin", {
    p_user_id: user.id,
  });
  if (!isAdminData) redirect("/");

  const admin = createAdminClient();
  const { data } = await admin
    .from("post_reports")
    .select(
      "id, reason, detail, status, created_at, post_id, reporter_id, posts:post_id(content, image_urls), reporter:reporter_id(display_name, handle)"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <>
      <Header />
      <PostReportsClient reports={(data ?? []) as unknown as PostReportRow[]} />
    </>
  );
}

export type PostReportRow = {
  id: string;
  reason: string;
  detail: string | null;
  status: "open" | "reviewed" | "dismissed";
  created_at: string;
  post_id: string;
  posts: { content: string; image_urls: string[] } | null;
  reporter: { display_name: string | null; handle: string } | null;
};
