import { notFound, redirect } from "next/navigation";
import Header from "@/components/Header";
import EditToolClient from "./EditToolClient";
import { createClient } from "@/lib/supabase/server";

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
      "id, slug, name, tagline, description, category, price, runtime, platforms, min_os_version, demo_url, thumbnail_url, file_key, status, author_id"
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

  const [{ data: canReceiveData }, { count: purchaseCount }] = await Promise.all([
    supabase.rpc("seller_can_receive_payments", { p_user_id: user.id }),
    supabase
      .from("purchases")
      .select("id", { count: "exact", head: true })
      .eq("tool_id", tool.id),
  ]);

  return (
    <>
      <Header />
      <EditToolClient
        tool={tool}
        canReceivePayments={Boolean(canReceiveData)}
        hasPurchases={Boolean(purchaseCount && purchaseCount > 0)}
      />
    </>
  );
}
