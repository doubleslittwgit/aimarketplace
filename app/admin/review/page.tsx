import { notFound } from "next/navigation";
import Header from "@/components/Header";
import AdminReviewClient from "./AdminReviewClient";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function AdminReviewPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) notFound();

  const { data: isAdminData } = await supabase.rpc("is_admin", {
    p_user_id: user.id,
  });
  // 管理者以外には、このページの存在自体を教えない
  if (!isAdminData) notFound();

  // 他人が出品した、まだ published でないツールも見る必要があるため、
  // ここでは（上で管理者確認が済んだ後にだけ）管理者権限のクライアントを使う。
  const admin = createAdminClient();
  const [{ data: pendingTools }, { data: publishedTools }] = await Promise.all([
    admin
      .from("tools")
      .select(
        "id, slug, name, tagline, description, category, price, runtime, platforms, min_os_version, thumbnail_url, file_key, ai_review_summary, ai_review_risk, created_at, author_id, profiles:author_id(display_name, handle)"
      )
      .eq("status", "pending_review")
      .order("created_at", { ascending: true }),
    admin
      .from("tools")
      .select(
        "id, slug, name, tagline, price, category, runtime, created_at, author_id, profiles:author_id(display_name, handle)"
      )
      .eq("status", "published")
      .order("created_at", { ascending: false }),
  ]);

  // 審査中ツールの「ツールのURL」を、別テーブルからまとめて取り出して合わせる
  const pendingIds = (pendingTools ?? []).map((t) => t.id);
  const { data: accessRows } = pendingIds.length
    ? await admin.from("tool_access_urls").select("tool_id, url").in("tool_id", pendingIds)
    : { data: [] as { tool_id: string; url: string }[] };
  const urlByTool = new Map((accessRows ?? []).map((r) => [r.tool_id, r.url]));
  const pendingWithUrls = (pendingTools ?? []).map((t) => ({
    ...t,
    demo_url: urlByTool.get(t.id) ?? null,
  }));

  return (
    <>
      <Header />
      <AdminReviewClient
        tools={pendingWithUrls as unknown as PendingToolFromDB[]}
        publishedTools={(publishedTools ?? []) as unknown as PublishedToolFromDB[]}
      />
    </>
  );
}

type PendingToolFromDB = Parameters<typeof AdminReviewClient>[0]["tools"][number];
type PublishedToolFromDB = Parameters<
  typeof AdminReviewClient
>[0]["publishedTools"][number];
