import { redirect } from "next/navigation";
import Header from "@/components/Header";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import RefundRequestsClient from "./RefundRequestsClient";
import { getAccessSummaries } from "@/lib/access-log";

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
  purchases: { price_paid: number; status: string; terms_accepted_at: string | null } | null;
  courses: { title: string; slug: string } | null;
  course_purchases: { price_paid: number; status: string; terms_accepted_at: string | null } | null;
  /** 購入者が商品を受け取った記録（ダウンロード・利用・閲覧）の要約 */
  access: { count: number; first: string | null; last: string | null } | null;
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
  // buyer_id は auth.users を参照しているため、profiles を埋め込みで取得できない
  // （以前は埋め込もうとして一覧の読み込み自体がエラーになり、報告が0件に見えていた）。
  // 購入者の名前は、別に profiles から取ってきて組み合わせる。
  const { data, error } = await admin
    .from("refund_requests")
    .select(
      "id, message, status, admin_note, created_at, purchase_id, course_purchase_id, buyer_id, tools:tool_id(name, slug), purchases:purchase_id(price_paid, status, terms_accepted_at), courses:course_id(title, slug), course_purchases:course_purchase_id(price_paid, status, terms_accepted_at)"
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) console.error("[admin/refund-requests] 読み込みに失敗:", error.message);

  const rows = (data ?? []) as unknown as (Omit<RefundRequestRow, "buyer" | "access"> & {
    buyer_id: string;
    course_purchase_id: string | null;
  })[];
  const buyerIds = Array.from(new Set(rows.map((r) => r.buyer_id)));
  const { data: buyers } = buyerIds.length
    ? await admin.from("profiles").select("id, display_name, handle").in("id", buyerIds)
    : { data: [] as { id: string; display_name: string | null; handle: string }[] };
  const buyerById = new Map((buyers ?? []).map((b) => [b.id, b]));
  // 購入者がすでに商品を受け取っているか（返金の判断材料）
  const accessById = await getAccessSummaries(admin, {
    purchaseIds: rows.map((r) => r.purchase_id).filter(Boolean),
    coursePurchaseIds: rows.map((r) => r.course_purchase_id).filter((x): x is string => Boolean(x)),
  });
  const requests: RefundRequestRow[] = rows.map((r) => {
    const b = buyerById.get(r.buyer_id);
    const access = accessById.get(r.purchase_id) ?? (r.course_purchase_id ? accessById.get(r.course_purchase_id) : undefined);
    return {
      ...r,
      buyer: b ? { display_name: b.display_name, handle: b.handle } : null,
      access: access ? { count: access.count, first: access.first, last: access.last } : null,
    };
  });

  return (
    <>
      <Header />
      {error && (
        <p className="mx-auto mt-6 max-w-3xl rounded-lg border border-accent-danger/30 bg-accent-danger/5 px-4 py-3 text-[13px] text-accent-danger">
          報告一覧の読み込みに失敗しました: {error.message}
        </p>
      )}
      <RefundRequestsClient requests={requests} />
    </>
  );
}
