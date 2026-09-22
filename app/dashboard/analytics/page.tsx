import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations, getLocale } from "next-intl/server";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SimpleBarChart from "@/components/SimpleBarChart";
import SalesReportDownload from "@/components/SalesReportDownload";
import { createClient } from "@/lib/supabase/server";
import { formatPrice, formatInstalls } from "@/lib/mock-data";
import type { Locale } from "@/i18n/config";

type ToolRow = {
  id: string;
  name: string;
  slug: string;
  view_count: number;
  like_count: number;
  install_count: number;
};

type SaleRow = {
  tool_id: string;
  seller_earnings: number;
  created_at: string;
};

const INTL_LOCALE: Record<string, string> = { ja: "ja-JP", zh: "zh-TW", en: "en-US" };
const DAYS = 30;

export async function generateMetadata() {
  const t = await getTranslations("analytics");
  return { title: t("title") };
}

export default async function AnalyticsPage() {
  const t = await getTranslations("analytics");
  const locale = (await getLocale()) as Locale;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/analytics");

  const since = new Date();
  since.setDate(since.getDate() - (DAYS - 1));
  since.setHours(0, 0, 0, 0);

  const [{ data: toolsData }, { data: salesData }] = await Promise.all([
    supabase
      .from("tools")
      .select("id, name, slug, view_count, like_count, install_count")
      .eq("author_id", user.id)
      .order("view_count", { ascending: false }),
    supabase
      .from("purchases")
      .select("tool_id, seller_earnings, created_at")
      .eq("seller_id", user.id)
      .eq("status", "completed")
      .gte("created_at", since.toISOString()),
  ]);

  const tools = (toolsData ?? []) as ToolRow[];
  const sales = (salesData ?? []) as SaleRow[];

  const totalViews = tools.reduce((sum, tool) => sum + tool.view_count, 0);
  const totalLikes = tools.reduce((sum, tool) => sum + tool.like_count, 0);
  const totalDownloads = tools.reduce((sum, tool) => sum + tool.install_count, 0);
  const last30DaysEarnings = sales.reduce((sum, s) => sum + s.seller_earnings, 0);

  // 直近30日分、1日ごとの売上合計を作る（データが無い日も0で埋めて、必ず30本並ぶようにする）
  const earningsByDay = new Map<string, number>();
  for (const s of sales) {
    const day = s.created_at.slice(0, 10);
    earningsByDay.set(day, (earningsByDay.get(day) ?? 0) + s.seller_earnings);
  }
  const chartData = Array.from({ length: DAYS }, (_, i) => {
    const d = new Date(since);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    return {
      label: d.toLocaleDateString(INTL_LOCALE[locale] ?? "ja-JP", { month: "numeric", day: "numeric" }),
      value: earningsByDay.get(key) ?? 0,
    };
  });

  const salesCountByTool = new Map<string, { count: number; earnings: number }>();
  for (const s of sales) {
    const current = salesCountByTool.get(s.tool_id) ?? { count: 0, earnings: 0 };
    current.count += 1;
    current.earnings += s.seller_earnings;
    salesCountByTool.set(s.tool_id, current);
  }

  return (
    <>
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-6 py-10">
          <Link
            href="/dashboard"
            className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-text-muted transition hover:text-text-primary"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            {t("backToDashboard")}
          </Link>

          <h1 className="mb-1 font-display text-2xl font-semibold text-text-primary">
            {t("title")}
          </h1>
          <p className="mb-8 text-[13px] text-text-muted">{t("subtitle")}</p>

          <SalesReportDownload currentYear={new Date().getFullYear()} />

          <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard label={t("totalViews")} value={formatInstalls(totalViews)} />
            <StatCard label={t("totalLikes")} value={formatInstalls(totalLikes)} accent />
            <StatCard label={t("totalDownloads")} value={formatInstalls(totalDownloads)} />
            <StatCard label={t("last30DaysEarnings")} value={`¥${last30DaysEarnings.toLocaleString()}`} />
          </div>

          <section className="mb-8 rounded-xl border border-border bg-surface p-5">
            <h2 className="mb-4 text-[13px] font-medium text-text-secondary">
              {t("earningsChartTitle")}
            </h2>
            {sales.length === 0 ? (
              <p className="py-8 text-center text-[13px] text-text-muted">{t("noEarningsYet")}</p>
            ) : (
              <SimpleBarChart data={chartData} formatValue={(n) => `¥${n.toLocaleString()}`} />
            )}
          </section>

          <section>
            <h2 className="mb-4 font-display text-lg font-semibold text-text-primary">
              {t("perToolBreakdown")}
            </h2>
            {tools.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border py-12 text-center text-[13px] text-text-muted">
                {t("noTools")}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border bg-surface">
                <table className="w-full text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-border text-[11px] uppercase tracking-wide text-text-dim">
                      <th className="px-4 py-3 font-medium">{t("tableName")}</th>
                      <th className="px-4 py-3 font-medium">{t("tableViews")}</th>
                      <th className="px-4 py-3 font-medium">{t("tableLikes")}</th>
                      <th className="px-4 py-3 font-medium">{t("tableDownloads")}</th>
                      <th className="px-4 py-3 font-medium">{t("tableSales")}</th>
                      <th className="px-4 py-3 font-medium">{t("tableEarnings")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {tools.map((tool) => {
                      const s = salesCountByTool.get(tool.id);
                      return (
                        <tr key={tool.id}>
                          <td className="max-w-[200px] truncate px-4 py-3 font-medium text-text-primary">
                            <Link href={`/apps/${tool.slug}`} className="hover:underline">
                              {tool.name}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-text-secondary">{tool.view_count.toLocaleString()}</td>
                          <td className="px-4 py-3 text-text-secondary">{tool.like_count.toLocaleString()}</td>
                          <td className="px-4 py-3 text-text-secondary">{tool.install_count.toLocaleString()}</td>
                          <td className="px-4 py-3 text-text-secondary">{s?.count ?? 0}</td>
                          <td className="px-4 py-3 font-medium text-text-primary">
                            {s ? formatPrice(s.earnings) : "¥0"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-[12px] text-text-muted">{label}</p>
      <p
        className={`mt-1 font-display text-xl font-semibold ${
          accent ? "text-accent-signal" : "text-text-primary"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
