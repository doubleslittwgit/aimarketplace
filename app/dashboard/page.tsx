import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SellerOnboardingButton from "@/components/SellerOnboardingButton";
import OnboardingChecklist from "@/components/OnboardingChecklist";
import SubmitSuccessModal from "@/components/SubmitSuccessModal";
import ReportTroubleButton from "@/components/ReportTroubleButton";
import AnnouncementBox from "@/components/AnnouncementBox";
import { createClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/mock-data";
import type { Locale } from "@/i18n/config";

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-surface-raised text-text-muted",
  pending_review: "bg-accent-ai-dim text-accent-ai",
  published: "bg-accent-success/10 text-accent-success",
  suspended: "bg-surface-raised text-text-muted",
  rejected: "bg-accent-danger/10 text-accent-danger",
};

const INTL_LOCALE: Record<string, string> = { ja: "ja-JP", zh: "zh-TW", en: "en-US" };

type PurchaseRow = {
  id: string;
  price_paid: number;
  status: string;
  created_at: string;
  tools: {
    id: string;
    slug: string;
    name: string;
    thumbnail_url: string | null;
    runtime: "cloud" | "local";
  } | null;
};

type OwnToolRow = {
  id: string;
  slug: string;
  name: string;
  price: number;
  status: string;
  install_count: number;
  like_count: number;
  updated_at: string;
  rejection_reason: string | null;
  thumbnail_url: string | null;
};

type SaleRow = {
  id: string;
  price_paid: number;
  seller_earnings: number;
  platform_fee: number;
  status: string;
  created_at: string;
  tools: { name: string; slug: string } | null;
  profiles: { display_name: string; handle: string } | null;
};

export default async function DashboardPage() {
  const t = await getTranslations("dashboard");
  const tAnalytics = await getTranslations("analytics");
  const locale = (await getLocale()) as Locale;
  const intlLocale = INTL_LOCALE[locale] ?? "ja-JP";
  const statusLabel = (status: string) =>
    ({
      draft: t("statusDraft"),
      pending_review: t("statusPendingReview"),
      published: t("statusPublished"),
      suspended: t("statusSuspended"),
      rejected: t("statusRejected"),
    })[status] ?? status;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/dashboard");
  }

  const [
    { data: profile },
    { data: purchasesData },
    { data: ownToolsData },
    { data: salesData },
    { count: postCount },
    { data: refundRequestsData },
    { count: followerCount },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, handle, avatar_url, bio")
      .eq("id", user.id)
      .single(),
    supabase
      .from("purchases")
      .select(
        "id, price_paid, status, created_at, tools(id, slug, name, thumbnail_url, runtime)"
      )
      .eq("buyer_id", user.id)
      .eq("status", "completed")
      .order("created_at", { ascending: false }),
    supabase
      .from("tools")
      .select("id, slug, name, price, status, install_count, like_count, updated_at, rejection_reason, thumbnail_url")
      .eq("author_id", user.id)
      .order("updated_at", { ascending: false }),
    supabase
      .from("purchases")
      .select(
        "id, price_paid, seller_earnings, platform_fee, status, created_at, tools(name, slug), profiles:buyer_id(display_name, handle)"
      )
      .eq("seller_id", user.id)
      .eq("status", "completed")
      .order("created_at", { ascending: false }),
    supabase.from("posts").select("*", { count: "exact", head: true }).eq("author_id", user.id),
    supabase.from("refund_requests").select("purchase_id").eq("buyer_id", user.id),
    supabase
      .from("follows")
      .select("follower_id", { count: "exact", head: true })
      .eq("following_id", user.id),
  ]);

  const purchases = (purchasesData ?? []) as unknown as PurchaseRow[];
  const ownTools = (ownToolsData ?? []) as OwnToolRow[];
  const sales = (salesData ?? []) as unknown as SaleRow[];
  const refundedPurchaseIds = new Set(
    (refundRequestsData ?? []).map((r) => r.purchase_id)
  );

  const totalEarnings = sales.reduce((sum, s) => sum + s.seller_earnings, 0);

  // 今月分の売上（Stripeの入金サイクルを意識しやすくするため）
  const now = new Date();
  const thisMonthEarnings = sales
    .filter((s) => {
      const d = new Date(s.created_at);
      return (
        d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
      );
    })
    .reduce((sum, s) => sum + s.seller_earnings, 0);

  // 受け取り設定の状態。自分の行はRLSで読めるため管理者権限は使わない。
  // destination charge 構成では charges_enabled は false のままが正常なので、
  // transfers_enabled && payouts_enabled で判定する。
  const { data: sellerAccount } = await supabase
    .from("seller_accounts")
    .select("transfers_enabled, payouts_enabled, details_submitted")
    .eq("user_id", user.id)
    .maybeSingle();

  const canReceive = Boolean(
    sellerAccount?.transfers_enabled && sellerAccount?.payouts_enabled
  );
  const onboardingStarted = Boolean(sellerAccount);

  const onboardingSteps = {
    profile: Boolean(profile?.bio?.trim() || profile?.avatar_url),
    firstListing: ownTools.length > 0,
    payout: canReceive,
    firstPost: (postCount ?? 0) > 0,
  };

  return (
    <>
      <Header />
      <SubmitSuccessModal />
      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-surface-raised">
                {profile?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="font-display text-[13px] font-semibold text-accent-ai">
                    {(profile?.display_name ?? user.email ?? "?").slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>
              <div>
                <h1 className="font-display text-2xl font-semibold text-text-primary">
                  {t("title")}
                </h1>
                <p className="mt-1 text-[13px] text-text-muted">
                  {t("loggedInAs", { name: profile?.display_name ?? user.email ?? "" })}
                  {profile?.handle ? (
                    <>
                      {" ・ "}
                      <Link href={`/u/${profile.handle}`} className="text-accent-signal hover:underline">
                        @{profile.handle}
                      </Link>
                      {" ・ "}
                      <Link href={`/u/${profile.handle}`} className="text-accent-signal hover:underline">
                        {t("viewProfile")}
                      </Link>
                    </>
                  ) : null}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard/analytics"
                className="flex items-center gap-1.5 text-[13px] text-text-muted hover:text-text-primary"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 3v18h18" />
                  <path d="M18.4 8.6 12 15l-3.5-3.5L4 16" />
                </svg>
                {tAnalytics("viewAnalytics")}
              </Link>
              <Link
                href="/dashboard/likes"
                className="flex items-center gap-1.5 text-[13px] text-text-muted hover:text-text-primary"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 1 0-7.8 7.8l1.1 1L12 21l7.7-7.7 1.1-1a5.5 5.5 0 0 0 0-7.8Z" />
                </svg>
                {t("favorites")}
              </Link>
            </div>
          </div>

          <OnboardingChecklist steps={onboardingSteps} handle={profile?.handle ?? null} />

          <AnnouncementBox followerCount={followerCount ?? 0} />

          {/* 購入済みツール */}
          <section className="mb-10">
            <h2 className="mb-4 font-display text-lg font-semibold text-text-primary">
              {t("purchasedTools")}
            </h2>
            {purchases.length === 0 ? (
              <div className="rounded-xl border border-border bg-surface p-6 text-center text-[13px] text-text-muted">
                {t("noPurchases")}
                <Link href="/browse" className="ml-1 text-accent-signal hover:underline">
                  {t("browseTools")}
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
                {purchases.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-4 px-5 py-4"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-bg">
                        {p.tools?.thumbnail_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={p.tools.thumbnail_url}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="font-display text-xs font-semibold text-text-dim/50">
                            {(p.tools?.name ?? "?").slice(0, 2).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <Link
                          href={p.tools ? `/apps/${p.tools.slug}` : "#"}
                          className="block truncate text-[14px] font-medium text-text-primary hover:text-accent-signal"
                        >
                          {p.tools?.name ?? t("deletedTool")}
                        </Link>
                        <p className="font-mono text-[11px] text-text-dim">
                          {formatPrice(p.price_paid)} ・{" "}
                          {t("purchasedOn", {
                            date: new Date(p.created_at).toLocaleDateString(intlLocale),
                          })}
                        </p>
                        {p.price_paid > 0 && (
                          <div className="mt-1">
                            <ReportTroubleButton
                              purchaseId={p.id}
                              toolName={p.tools?.name ?? ""}
                              alreadySubmitted={refundedPurchaseIds.has(p.id)}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                    {p.tools && p.tools.runtime === "local" && (
                      <a
                        href={`/apps/download/${p.tools.id}`}
                        className="shrink-0 rounded-lg bg-accent-success px-3.5 py-2 text-[13px] font-medium text-white transition hover:brightness-105"
                      >
                        {t("download")}
                      </a>
                    )}
                    {/* ツールのURLは画面に埋め込まず、購入を確認してから
                        転送する経路（/apps/download）を通して開く */}
                    {p.tools && p.tools.runtime === "cloud" && (
                      <a
                        href={`/apps/download/${p.tools.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 rounded-lg bg-accent-success px-3.5 py-2 text-[13px] font-medium text-white transition hover:brightness-105"
                      >
                        {t("openTool")}
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 出品したツール */}
          <section className="mb-10">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold text-text-primary">
                {t("myListings")}
              </h2>
              <Link
                href="/submit"
                className="text-[13px] text-accent-signal hover:underline"
              >
                {t("newListing")}
              </Link>
            </div>
            {ownTools.length === 0 ? (
              <div className="rounded-xl border border-border bg-surface p-6 text-center text-[13px] text-text-muted">
                {t("noListings")}
              </div>
            ) : (
              <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
                {ownTools.map((tool) => (
                  <div
                    key={tool.id}
                    className="flex items-center justify-between gap-4 px-5 py-4"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      {/* 購入済みツールと同じ大きさの画像（無ければ名前の頭文字） */}
                      <Link
                        href={`/apps/${tool.slug}`}
                        className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-bg"
                      >
                        {tool.thumbnail_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={tool.thumbnail_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span className="font-display text-xs font-semibold text-text-dim/50">
                            {tool.name.slice(0, 2).toUpperCase()}
                          </span>
                        )}
                      </Link>
                      <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/apps/${tool.slug}`}
                          className="truncate text-[14px] font-medium text-text-primary hover:text-accent-signal"
                        >
                          {tool.name}
                        </Link>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] tracking-wide ${
                            STATUS_STYLE[tool.status] ?? "bg-surface-raised text-text-muted"
                          }`}
                        >
                          {statusLabel(tool.status)}
                        </span>
                      </div>
                      <p className="mt-0.5 font-mono text-[11px] text-text-dim">
                        {formatPrice(tool.price)} ・ {tool.install_count.toLocaleString()} installs ・
                        ♥ {tool.like_count}
                      </p>
                      {tool.status === "rejected" && tool.rejection_reason && (
                        <p className="mt-1.5 max-w-md text-[11px] leading-relaxed text-accent-danger">
                          {t("rejectionReason", { reason: tool.rejection_reason })}
                        </p>
                      )}
                      {tool.status === "suspended" && tool.rejection_reason && (
                        <p className="mt-1.5 max-w-md text-[11px] leading-relaxed text-accent-danger">
                          {t("suspendedByAdmin", { reason: tool.rejection_reason })}
                        </p>
                      )}
                      {tool.status === "pending_review" && (
                        <p className="mt-1.5 text-[11px] text-text-dim">
                          {t("pendingReviewNotice")}
                        </p>
                      )}
                      </div>
                    </div>
                    <Link
                      href={tool.status === "draft" ? `/submit?draft=${tool.id}` : `/apps/${tool.slug}/edit`}
                      className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-[12px] text-text-secondary transition hover:bg-surface-raised"
                    >
                      {tool.status === "draft" ? t("continueEditing") : t("edit")}
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 売上 */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold text-text-primary">
                {t("sales")}
              </h2>
              {sales.length > 0 && (
                <a
                  href="/api/dashboard/sales-csv"
                  className="flex items-center gap-1.5 text-[12px] text-text-muted hover:text-text-primary"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3v12" />
                    <path d="m7 10 5 5 5-5" />
                    <path d="M5 21h14" />
                  </svg>
                  {t("downloadCsv")}
                </a>
              )}
            </div>

            <div className="mb-4 rounded-xl border border-border bg-surface p-5">
              <div className="flex flex-wrap gap-x-10 gap-y-4">
                <div>
                  <p className="text-[12px] text-text-muted">
                    {t("totalEarnings")}
                  </p>
                  <p className="mt-1 font-display text-2xl font-semibold text-text-primary">
                    ¥{totalEarnings.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-[12px] text-text-muted">{t("thisMonthEarnings")}</p>
                  <p className="mt-1 font-display text-2xl font-semibold text-text-primary">
                    ¥{thisMonthEarnings.toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="mt-5 border-t border-border pt-4">
                {canReceive ? (
                  <>
                    <div className="mb-3 flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-success" />
                      <p className="text-[13px] text-text-secondary">
                        {t("payoutAutoNotice")}
                        <span className="block text-text-muted">
                          {t("payoutAutoDetail")}
                        </span>
                      </p>
                    </div>
                    <div className="sm:max-w-xs">
                      <SellerOnboardingButton
                        action="dashboard"
                        label={t("checkPayouts")}
                        variant="secondary"
                      />
                    </div>
                  </>
                ) : onboardingStarted ? (
                  <>
                    <div className="mb-3 flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-ai" />
                      <p className="text-[13px] text-text-secondary">
                        {t("onboardingIncompleteNotice")}
                        <span className="block text-text-muted">
                          {t("onboardingIncompleteDetail")}
                        </span>
                      </p>
                    </div>
                    <Link
                      href="/seller"
                      className="inline-block rounded-lg bg-accent-signal px-4 py-2.5 text-[13px] font-medium text-white transition hover:brightness-105"
                    >
                      {t("continueSetup")}
                    </Link>
                  </>
                ) : (
                  <>
                    <p className="mb-3 text-[13px] text-text-secondary">
                      {t("needsSetupNotice")}
                      <span className="block text-text-muted">
                        {t("needsSetupDetail")}
                      </span>
                    </p>
                    <Link
                      href="/seller"
                      className="inline-block rounded-lg bg-accent-signal px-4 py-2.5 text-[13px] font-medium text-white transition hover:brightness-105"
                    >
                      {t("startSetup")}
                    </Link>
                  </>
                )}
              </div>
            </div>

            {sales.length === 0 ? (
              <div className="rounded-xl border border-border bg-surface p-6 text-center text-[13px] text-text-muted">
                {t("noSales")}
              </div>
            ) : (
              <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
                {sales.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between gap-4 px-5 py-4"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-medium text-text-primary">
                        {s.tools?.name ?? t("deletedTool")}
                      </p>
                      <p className="font-mono text-[11px] text-text-dim">
                        {t("buyer", { name: s.profiles?.display_name ?? t("unknown") })} ・{" "}
                        {new Date(s.created_at).toLocaleDateString(intlLocale)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-mono text-[13px] font-medium text-accent-signal">
                        +{formatPrice(s.seller_earnings)}
                      </p>
                      <p className="font-mono text-[11px] text-text-dim">
                        {t("saleBreakdown", {
                          price: formatPrice(s.price_paid),
                          fee: formatPrice(s.platform_fee),
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
      <Footer width="max-w-6xl" />
    </>
  );
}
