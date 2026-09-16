import Link from "next/link";
import { redirect } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SellerOnboardingButton from "@/components/SellerOnboardingButton";
import { createClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/mock-data";

const STATUS_LABEL: Record<string, string> = {
  draft: "下書き",
  pending_review: "審査中",
  published: "公開中",
  suspended: "非公開",
  rejected: "却下",
};

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-surface-raised text-text-muted",
  pending_review: "bg-accent-ai-dim text-accent-ai",
  published: "bg-accent-success/10 text-accent-success",
  suspended: "bg-surface-raised text-text-muted",
  rejected: "bg-accent-danger/10 text-accent-danger",
};

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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/dashboard");
  }

  const [{ data: profile }, { data: purchasesData }, { data: ownToolsData }, { data: salesData }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("display_name, handle, avatar_url")
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
        .select("id, slug, name, price, status, install_count, like_count, updated_at, rejection_reason")
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
    ]);

  const purchases = (purchasesData ?? []) as unknown as PurchaseRow[];
  const ownTools = (ownToolsData ?? []) as OwnToolRow[];
  const sales = (salesData ?? []) as unknown as SaleRow[];

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

  return (
    <>
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="font-display text-2xl font-semibold text-text-primary">
                マイページ
              </h1>
              <p className="mt-1 text-[13px] text-text-muted">
                {profile?.display_name ?? user.email} としてログイン中
                {profile?.handle ? ` ・ @${profile.handle}` : ""}
              </p>
            </div>
            <Link
              href="/dashboard/likes"
              className="flex items-center gap-1.5 text-[13px] text-text-muted hover:text-text-primary"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 1 0-7.8 7.8l1.1 1L12 21l7.7-7.7 1.1-1a5.5 5.5 0 0 0 0-7.8Z" />
              </svg>
              お気に入り
            </Link>
          </div>

          {/* 購入済みツール */}
          <section className="mb-10">
            <h2 className="mb-4 font-display text-lg font-semibold text-text-primary">
              購入済みツール
            </h2>
            {purchases.length === 0 ? (
              <div className="rounded-xl border border-border bg-surface p-6 text-center text-[13px] text-text-muted">
                まだ購入したツールはありません。
                <Link href="/browse" className="ml-1 text-accent-signal hover:underline">
                  ツールを探す
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
                          {p.tools?.name ?? "削除されたツール"}
                        </Link>
                        <p className="font-mono text-[11px] text-text-dim">
                          {formatPrice(p.price_paid)} ・{" "}
                          {new Date(p.created_at).toLocaleDateString("ja-JP")} 購入
                        </p>
                      </div>
                    </div>
                    {p.tools && (
                      <a
                        href={`/apps/download/${p.tools.id}`}
                        className="shrink-0 rounded-lg bg-accent-success px-3.5 py-2 text-[13px] font-medium text-white transition hover:brightness-105"
                      >
                        ダウンロード
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
                出品したツール
              </h2>
              <Link
                href="/submit"
                className="text-[13px] text-accent-signal hover:underline"
              >
                + 新しく出品する
              </Link>
            </div>
            {ownTools.length === 0 ? (
              <div className="rounded-xl border border-border bg-surface p-6 text-center text-[13px] text-text-muted">
                まだ出品したツールはありません。
              </div>
            ) : (
              <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
                {ownTools.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between gap-4 px-5 py-4"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/apps/${t.slug}`}
                          className="truncate text-[14px] font-medium text-text-primary hover:text-accent-signal"
                        >
                          {t.name}
                        </Link>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] tracking-wide ${
                            STATUS_STYLE[t.status] ?? "bg-surface-raised text-text-muted"
                          }`}
                        >
                          {STATUS_LABEL[t.status] ?? t.status}
                        </span>
                      </div>
                      <p className="mt-0.5 font-mono text-[11px] text-text-dim">
                        {formatPrice(t.price)} ・ {t.install_count.toLocaleString()} installs ・
                        ♥ {t.like_count}
                      </p>
                      {t.status === "rejected" && t.rejection_reason && (
                        <p className="mt-1.5 max-w-md text-[11px] leading-relaxed text-accent-danger">
                          却下理由: {t.rejection_reason}
                        </p>
                      )}
                      {t.status === "suspended" && t.rejection_reason && (
                        <p className="mt-1.5 max-w-md text-[11px] leading-relaxed text-accent-danger">
                          運営により非公開にされました。理由: {t.rejection_reason}
                        </p>
                      )}
                      {t.status === "pending_review" && (
                        <p className="mt-1.5 text-[11px] text-text-dim">
                          管理者の審査待ちです。承認されると公開されます。
                        </p>
                      )}
                    </div>
                    <Link
                      href={`/apps/${t.slug}/edit`}
                      className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-[12px] text-text-secondary transition hover:bg-surface-raised"
                    >
                      編集
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 売上 */}
          <section>
            <h2 className="mb-4 font-display text-lg font-semibold text-text-primary">
              売上
            </h2>

            <div className="mb-4 rounded-xl border border-border bg-surface p-5">
              <div className="flex flex-wrap gap-x-10 gap-y-4">
                <div>
                  <p className="text-[12px] text-text-muted">
                    累計売上(手数料差引後)
                  </p>
                  <p className="mt-1 font-display text-2xl font-semibold text-text-primary">
                    {formatPrice(totalEarnings)}
                  </p>
                </div>
                <div>
                  <p className="text-[12px] text-text-muted">今月の売上</p>
                  <p className="mt-1 font-display text-2xl font-semibold text-text-primary">
                    {formatPrice(thisMonthEarnings)}
                  </p>
                </div>
              </div>

              <div className="mt-5 border-t border-border pt-4">
                {canReceive ? (
                  <>
                    <div className="mb-3 flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-success" />
                      <p className="text-[13px] text-text-secondary">
                        売上は登録済みの口座へ自動で入金されます。
                        <span className="block text-text-muted">
                          入金のタイミングや明細、振込先の変更はStripeの画面から確認できます。
                        </span>
                      </p>
                    </div>
                    <div className="sm:max-w-xs">
                      <SellerOnboardingButton
                        action="dashboard"
                        label="Stripeで入金・明細を確認する"
                        variant="secondary"
                      />
                    </div>
                  </>
                ) : onboardingStarted ? (
                  <>
                    <div className="mb-3 flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-ai" />
                      <p className="text-[13px] text-text-secondary">
                        受け取り設定が完了していません。
                        <span className="block text-text-muted">
                          設定が終わるまで、有料ツールの販売と売上の入金はできません。
                        </span>
                      </p>
                    </div>
                    <Link
                      href="/seller"
                      className="inline-block rounded-lg bg-accent-signal px-4 py-2.5 text-[13px] font-medium text-white transition hover:brightness-105"
                    >
                      設定の続きへ
                    </Link>
                  </>
                ) : (
                  <>
                    <p className="mb-3 text-[13px] text-text-secondary">
                      有料ツールを販売するには、売上の受け取り設定が必要です。
                      <span className="block text-text-muted">
                        無料ツールの公開には設定は不要です。
                      </span>
                    </p>
                    <Link
                      href="/seller"
                      className="inline-block rounded-lg bg-accent-signal px-4 py-2.5 text-[13px] font-medium text-white transition hover:brightness-105"
                    >
                      受け取り設定を始める
                    </Link>
                  </>
                )}
              </div>
            </div>

            {sales.length === 0 ? (
              <div className="rounded-xl border border-border bg-surface p-6 text-center text-[13px] text-text-muted">
                まだ販売実績はありません。
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
                        {s.tools?.name ?? "削除されたツール"}
                      </p>
                      <p className="font-mono text-[11px] text-text-dim">
                        購入者: {s.profiles?.display_name ?? "不明"} ・{" "}
                        {new Date(s.created_at).toLocaleDateString("ja-JP")}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-mono text-[13px] font-medium text-accent-signal">
                        +{formatPrice(s.seller_earnings)}
                      </p>
                      <p className="font-mono text-[11px] text-text-dim">
                        (販売 {formatPrice(s.price_paid)} ・ 手数料 {formatPrice(s.platform_fee)})
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
