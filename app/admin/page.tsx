import { redirect } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatPrice } from "@/lib/mock-data";

export const metadata = { title: "管理ダッシュボード" };

/**
 * 管理画面のトップ。
 *
 * 「審査」「ツール通報」「投稿通報」「返金」が別々のページに散っていて、
 * どこに未対応が溜まっているのか一覧できなかったため、
 * 未対応件数を1画面に集約している。
 */
export default async function AdminHomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/admin");

  const { data: isAdminData } = await supabase.rpc("is_admin", {
    p_user_id: user.id,
  });
  if (!isAdminData) redirect("/");

  const admin = createAdminClient();
  const since30Date = new Date();
  since30Date.setDate(since30Date.getDate() - 30);
  const since30 = since30Date.toISOString();

  const [
    { count: pendingReviews },
    { count: toolReports },
    { count: postReports },
    { count: refundRequests },
    { count: publishedTools },
    { count: totalUsers },
    { data: recentSales },
  ] = await Promise.all([
    admin.from("tools").select("id", { count: "exact", head: true }).eq("status", "pending_review"),
    // 通報の未対応は "open"（返金申告は "pending"）で、テーブルごとに語彙が違う
    admin.from("tool_reports").select("id", { count: "exact", head: true }).eq("status", "open"),
    admin.from("post_reports").select("id", { count: "exact", head: true }).eq("status", "open"),
    admin.from("refund_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    admin.from("tools").select("id", { count: "exact", head: true }).eq("status", "published"),
    admin.from("profiles").select("id", { count: "exact", head: true }),
    admin
      .from("purchases")
      .select("price_paid, platform_fee")
      .eq("status", "completed")
      .gte("created_at", since30),
  ]);

  const sales = recentSales ?? [];
  const gmv = sales.reduce((s, p) => s + (p.price_paid ?? 0), 0);
  const revenue = sales.reduce((s, p) => s + (p.platform_fee ?? 0), 0);

  const queues = [
    {
      href: "/admin/review",
      label: "出品の審査",
      count: pendingReviews ?? 0,
      description: "公開を待っているツール",
    },
    {
      href: "/admin/refund-requests",
      label: "返金・トラブル報告",
      count: refundRequests ?? 0,
      description: "買い手からの申告",
    },
    {
      href: "/admin/reports",
      label: "ツールの通報",
      count: toolReports ?? 0,
      description: "問題のある出品の報告",
    },
    {
      href: "/admin/post-reports",
      label: "投稿の通報",
      count: postReports ?? 0,
      description: "フィード投稿の報告",
    },
  ];

  const totalPending = queues.reduce((s, q) => s + q.count, 0);

  return (
    <>
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-6 py-10">
          <h1 className="mb-1 font-display text-2xl font-semibold text-text-primary">
            管理ダッシュボード
          </h1>
          <p className="mb-8 text-[13px] text-text-muted">
            {totalPending > 0
              ? `未対応が ${totalPending} 件あります。`
              : "未対応の案件はありません。"}
          </p>

          {/* 対応待ちの一覧 */}
          <div className="mb-8 space-y-2.5">
            {queues.map((q) => (
              <Link
                key={q.href}
                href={q.href}
                className={`flex items-center justify-between gap-4 rounded-xl border px-4 py-3.5 transition ${
                  q.count > 0
                    ? "border-accent-danger/30 bg-accent-danger/[0.03] hover:border-accent-danger/50"
                    : "border-border bg-surface hover:border-border-strong"
                }`}
              >
                <div>
                  <p className="text-[13px] font-medium text-text-primary">{q.label}</p>
                  <p className="mt-0.5 text-[12px] text-text-dim">{q.description}</p>
                </div>
                <span
                  className={`shrink-0 font-display text-xl font-semibold ${
                    q.count > 0 ? "text-accent-danger" : "text-text-dim"
                  }`}
                >
                  {q.count}
                </span>
              </Link>
            ))}
          </div>

          {/* サービス全体の状況 */}
          <h2 className="mb-3 text-[13px] font-medium text-text-secondary">
            サービスの状況
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="公開中のツール" value={String(publishedTools ?? 0)} />
            <StatCard label="登録ユーザー" value={String(totalUsers ?? 0)} />
            <StatCard label="流通総額（30日）" value={formatPrice(gmv)} />
            <StatCard label="手数料収入（30日）" value={formatPrice(revenue)} accent />
          </div>
        </div>
      </main>
    </>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-[12px] text-text-muted">{label}</p>
      <p
        className={`mt-1 font-display text-lg font-semibold ${
          accent ? "text-accent-signal" : "text-text-primary"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
