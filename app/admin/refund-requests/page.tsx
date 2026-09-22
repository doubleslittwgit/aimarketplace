import { redirect } from "next/navigation";
import Header from "@/components/Header";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import RefundRequestsClient from "./RefundRequestsClient";

export const metadata = { title: "返金・トラブル報告を確認" };

export type RefundRequestRow = {
  id: string;
  message: string;
  status: "pending" | "resolved" | "dismissed";
  admin_note: string | null;
  created_at: string;
  purchase_id: string;
  tools: { name: string; slug: string } | null;
  buyer: { display_name: string | null; handle: string } | null;
  purchases: { price_paid: number } | null;
};

export default async function AdminRefundRequestsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/admin/refund-requests");

  const { data: isAdminData } = await supabase.rpc("is_admin", {
    p_user_id: user.id,
  });
  if (!isAdminData) redirect("/");

  const admin = createAdminClient();
  const { data } = await admin
    .from("refund_requests")
    .select(
      "id, message, status, admin_note, created_at, purchase_id, tools:tool_id(name, slug), buyer:buyer_id(display_name, handle), purchases:purchase_id(price_paid)"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <>
      <Header />
      <RefundRequestsClient requests={(data ?? []) as unknown as RefundRequestRow[]} />
    </>
  );
}
