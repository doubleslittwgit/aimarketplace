import { redirect } from "next/navigation";
import Header from "@/components/Header";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import ReportsClient from "./ReportsClient";

export const metadata = { title: "通報の確認" };

export default async function AdminReportsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/admin/reports");

  const { data: isAdminData } = await supabase.rpc("is_admin", {
    p_user_id: user.id,
  });
  if (!isAdminData) redirect("/");

  const admin = createAdminClient();
  const { data } = await admin
    .from("tool_reports")
    .select(
      "id, reason, detail, status, created_at, tool_id, reporter_id, tools:tool_id(name, slug), reporter:reporter_id(display_name, handle)"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <>
      <Header />
      <ReportsClient reports={(data ?? []) as unknown as ReportRow[]} />
    </>
  );
}

export type ReportRow = {
  id: string;
  reason: string;
  detail: string | null;
  status: "open" | "reviewed" | "dismissed";
  created_at: string;
  tools: { name: string; slug: string } | null;
  reporter: { display_name: string | null; handle: string } | null;
};
