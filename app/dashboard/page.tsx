import Link from "next/link";
import { redirect } from "next/navigation";
import Header from "@/components/Header";
import { createClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/mock-data";

const STATUS_LABEL: Record<string, string> = {
  draft: "下書き",
  pending_review: "審査中",
  published: "公開中",
  suspended: "停止中",
};

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-surface-raised text-text-muted",
  pending_review: "bg-accent-ai-dim text-accent-ai",
  published: "bg-accent-success/10 text-accent-success",
  suspended: "bg-accent-danger/10 text-accent-danger",
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
        .select("id, slug, name, price, status, install_count, like_count, updated_at")
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

  return (
    <>
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="mb-8">
            <h1 className="font-display text-2xl font-semibold text-text-primary">
              マイページ
            </h1>
            <p className="mt-1 text-[13px] text-text-muted">
              {profile?.display_name ?? user.email} としてログイン中
              {profile?.handle ? ` ・ @${profile.handle}` : ""}
            </p>
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
              <p className="text-[12px] text-text-muted">累計売上(手数料差引後)</p>
              <p className="mt-1 font-display text-2xl font-semibold text-text-primary">
                {formatPrice(totalEarnings)}
              </p>
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
    </>
  );
}
