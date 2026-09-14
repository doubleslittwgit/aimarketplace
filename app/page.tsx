import Header from "@/components/Header";
import ActivityTicker from "@/components/ActivityTicker";
import ToolCard from "@/components/ToolCard";
import { createClient } from "@/lib/supabase/server";
import {
  tools as mockTools,
  categories,
  formatInstalls,
  formatPrice,
  type Tool,
} from "@/lib/mock-data";

async function loadRealTools(): Promise<Tool[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tools")
    .select("*, profiles:author_id(display_name, handle)")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(6);

  return (
    data?.map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      tagline: r.tagline,
      description: r.description,
      category: r.category,
      price: r.price,
      version: r.version,
      installs: r.install_count,
      likes: r.like_count,
      author: {
        name: r.profiles?.display_name || "名前未設定の開発者",
        handle: r.profiles?.handle ? `@${r.profiles.handle}` : "",
      },
      tags: r.tags || [],
      updatedAt: (r.updated_at || "").slice(0, 10),
      runtime: r.runtime,
      thumbnailUrl: r.thumbnail_url || null,
    })) || []
  );
}

export default async function Home() {
  const realTools = await loadRealTools();
  // 実際の出品を先頭に、足りない分をデモ用ツールで埋める（最大6件表示）
  const tools = [...realTools, ...mockTools].slice(0, 6);
  // ヒーローで浮かせる4件（新着ツールと重複してよい紹介枠）
  const floatTools = tools.slice(0, 4);

  return (
    <>
      <Header />
      <ActivityTicker />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          {/* 淡い青のブラー */}
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-20 left-[18%] h-72 w-72 rounded-full bg-accent-ai/20 blur-[100px]" />
            <div className="absolute top-6 right-[15%] h-80 w-80 rounded-full bg-accent-ai/15 blur-[110px]" />
            <div className="absolute bottom-[-4rem] left-1/2 h-64 w-[36rem] -translate-x-1/2 rounded-full bg-accent-signal/10 blur-[120px]" />
          </div>

          <div className="relative mx-auto max-w-7xl px-6 py-20 sm:py-24">
            {/* 実際に出品されているツールを浮かせて紹介（デスクトップのみ） */}
            {floatTools[0] && (
              <FloatingCard
                tool={floatTools[0]}
                className="left-0 top-2 hidden -rotate-3 lg:block xl:left-4"
                anim="float-a"
                duration="9s"
              />
            )}
            {floatTools[1] && (
              <FloatingCard
                tool={floatTools[1]}
                className="left-6 bottom-4 hidden rotate-2 lg:block xl:left-16"
                anim="float-b"
                duration="11s"
              />
            )}
            {floatTools[2] && (
              <FloatingCard
                tool={floatTools[2]}
                className="right-0 top-6 hidden rotate-3 lg:block xl:right-4"
                anim="float-c"
                duration="10s"
              />
            )}
            {floatTools[3] && (
              <FloatingCard
                tool={floatTools[3]}
                className="right-6 bottom-0 hidden -rotate-2 lg:block xl:right-16"
                anim="float-d"
                duration="12.5s"
              />
            )}

            <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="BuildBay" className="h-14 w-auto sm:h-[4.5rem]" />

              <h1 className="mt-8 font-display text-[2.5rem] font-semibold leading-[1.12] tracking-tight text-text-primary sm:text-[3.25rem]">
                あなたのアイデアが、
                <br />
                <span className="text-accent-signal">世界を変える。</span>
              </h1>
              <p className="mt-5 max-w-md text-[15px] leading-relaxed text-text-secondary">
                Claude Codeやカーソルで作ったAIツールを、無料でも有料でも公開できるマーケットプレイス。
                価格は0円から、あなたが決める。
              </p>

              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <a
                  href="/submit"
                  className="rounded-lg bg-accent-signal px-5 py-3 text-sm font-medium text-white transition hover:brightness-110"
                >
                  ツールを公開する
                </a>
                <a
                  href="/browse"
                  className="rounded-lg border border-border px-5 py-3 text-sm font-medium text-text-primary transition hover:border-border-strong hover:bg-surface"
                >
                  マーケットを見る
                </a>
              </div>
            </div>

            <div className="mx-auto mt-16 flex max-w-2xl flex-wrap justify-center gap-x-10 gap-y-4 border-t border-border pt-8 font-mono text-[13px]">
              <Stat label="公開ツール" value={`${mockTools.length * 253 + realTools.length}+`} />
              <Stat label="開発者" value="480+" />
              <Stat label="累計ダウンロード" value="52.3k" />
              <Stat label="開発者への還元率" value="80%" accent />
            </div>
          </div>
        </section>

        {/* Category rail */}
        <section className="border-y border-border bg-surface/40">
          <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-6 py-4">
            <CategoryPill label="すべて" active />
            {categories.map((c) => (
              <CategoryPill key={c} label={c} />
            ))}
          </div>
        </section>

        {/* Listing */}
        <section className="mx-auto max-w-7xl px-6 py-14">
          <div className="mb-6 flex items-baseline justify-between">
            <h2 className="font-display text-xl font-semibold text-text-primary">
              新着ツール
            </h2>
            <a href="/browse" className="text-[13px] text-text-muted hover:text-text-primary">
              すべて見る →
            </a>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {tools.map((tool) => (
              <ToolCard key={tool.id} tool={tool} />
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-7xl px-6 py-10 text-[13px] text-text-dim">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <span className="font-display text-text-muted">forge.</span>
            <div className="flex gap-6">
              <a href="#" className="hover:text-text-secondary">利用規約</a>
              <a href="#" className="hover:text-text-secondary">プライバシーポリシー</a>
              <a href="#" className="hover:text-text-secondary">お問い合わせ</a>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <span className={`text-lg font-medium ${accent ? "text-accent-signal" : "text-text-primary"}`}>
        {value}
      </span>
      <span className="text-text-dim">{label}</span>
    </div>
  );
}

function FloatingCard({
  tool,
  className,
  anim,
  duration,
}: {
  tool: Tool;
  className: string;
  anim: "float-a" | "float-b" | "float-c" | "float-d";
  duration: string;
}) {
  return (
    <a
      href={`/apps/${tool.slug}`}
      data-float
      style={{ animation: `${anim} ${duration} ease-in-out infinite` }}
      className={`absolute z-10 w-52 rounded-xl border border-border bg-bg/90 p-3.5 shadow-[0_12px_30px_-12px_rgba(22,35,45,0.18)] backdrop-blur-sm transition hover:border-border-strong ${className}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-display text-[13px] font-semibold leading-tight text-text-primary">
          {tool.name}
        </span>
        <span
          className={`shrink-0 rounded-full px-1.5 py-0.5 font-mono text-[9px] tracking-wide ${
            tool.runtime === "local"
              ? "bg-accent-ai-dim text-accent-ai"
              : "border border-border text-text-muted"
          }`}
        >
          {tool.runtime === "local" ? "LOCAL" : "CLOUD"}
        </span>
      </div>
      <p className="mt-1.5 line-clamp-2 text-[12px] leading-snug text-text-secondary">
        {tool.tagline}
      </p>
      <div className="mt-3 flex items-center justify-between font-mono text-[11px] text-text-dim">
        <span className="flex items-center gap-1">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2 2 7l10 5 10-5-10-5Z" opacity=".5" />
            <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
          {formatInstalls(tool.installs)}
        </span>
        <span className={tool.price === 0 ? "text-text-muted" : "text-accent-signal"}>
          {formatPrice(tool.price)}
        </span>
      </div>
    </a>
  );
}

function CategoryPill({ label, active }: { label: string; active?: boolean }) {
  return (
    <button
      className={`shrink-0 whitespace-nowrap rounded-full border px-4 py-1.5 text-[13px] transition ${
        active
          ? "border-accent-signal/40 bg-accent-signal-dim text-accent-signal"
          : "border-border text-text-secondary hover:border-border-strong hover:text-text-primary"
      }`}
    >
      {label}
    </button>
  );
}
