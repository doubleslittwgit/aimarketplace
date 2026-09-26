import { notFound, redirect } from "next/navigation";
import Header from "@/components/Header";
import EditToolClient from "./EditToolClient";
import { createClient } from "@/lib/supabase/server";

// 出品ページと同じ理由（大きなファイル＋AI再審査＋複数アップロードが
// 1回のリクエストで走りうるため）で、実行時間上限を引き上げる。
export const maxDuration = 60;

export default async function EditToolPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=/apps/${slug}/edit`);
  }

  const { data: tool } = await supabase
    .from("tools")
    .select(
      "id, slug, name, tagline, description, category, categories, host_apps, price, sale_price, sale_ends_at, remix_allowed, refund_policy, is_wip, video_url, runtime, internet_access, platforms, min_os_version, thumbnail_url, gallery_urls, file_key, status, author_id"
    )
    .eq("slug", slug)
    .maybeSingle();

  if (!tool) {
    notFound();
  }
  if (tool.author_id !== user.id) {
    // 他人のツールの編集ページは、存在自体を教えない
    notFound();
  }

  const [{ data: canReceiveData }, { count: purchaseCount }, { data: access }] = await Promise.all([
    supabase.rpc("seller_can_receive_payments", { p_user_id: user.id }),
    supabase
      .from("purchases")
      .select("id", { count: "exact", head: true })
      .eq("tool_id", tool.id),
    // ツールのURLは別テーブルに保存している（出品者本人なので読める）
    supabase.from("tool_access_urls").select("url").eq("tool_id", tool.id).maybeSingle(),
  ]);

  return (
    <>
      <Header />
      <EditToolClient
        tool={{ ...tool, demo_url: access?.url ?? null }}
        canReceivePayments={Boolean(canReceiveData)}
        hasPurchases={Boolean(purchaseCount && purchaseCount > 0)}
      />
    </>
  );
}
