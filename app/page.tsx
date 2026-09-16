import Header from "@/components/Header";
import Footer from "@/components/Footer";
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
            <div className="absolute -top-24 left-[12%] h-96 w-96 rounded-full bg-accent-ai/20 blur-[120px]" />
            <div className="absolute top-4 right-[10%] h-[26rem] w-[26rem] rounded-full bg-accent-ai/15 blur-[130px]" />
            <div className="absolute bottom-[-6rem] left-1/2 h-80 w-[44rem] -translate-x-1/2 rounded-full bg-accent-signal/10 blur-[130px]" />
          </div>

          <div className="relative mx-auto max-w-7xl px-6 py-16 sm:py-36">
            {/* 実際に出品されているツールを浮かせて紹介（十分な余白が取れる画面幅のみ） */}
            {floatTools[0] && (
              <FloatingCard
                tool={floatTools[0]}
                index={0}
                className="left-0 top-4 hidden -rotate-3 xl:block"
                anim="float-a"
                duration="9s"
              />
            )}
            {floatTools[1] && (
              <FloatingCard
                tool={floatTools[1]}
                index={1}
                className="left-2 bottom-6 hidden rotate-2 xl:block"
                anim="float-b"
                duration="11s"
              />
            )}
            {floatTools[2] && (
              <FloatingCard
                tool={floatTools[2]}
                index={2}
                className="right-0 top-10 hidden rotate-3 xl:block"
                anim="float-c"
                duration="10s"
              />
            )}
            {floatTools[3] && (
              <FloatingCard
                tool={floatTools[3]}
                index={3}
                className="right-2 bottom-0 hidden -rotate-2 xl:block"
                anim="float-d"
                duration="12.5s"
              />
            )}

            <div className="mx-auto flex max-w-xl flex-col items-center text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="BuildBay" className="h-20 w-auto sm:h-28 md:h-32" />

              <h1 className="mt-10 font-display text-3xl font-semibold leading-[1.1] tracking-tight text-text-primary sm:text-[4rem] md:text-[4.5rem]">
                あなたのアイデアが、
                <br />
                <span className="text-accent-signal">世界を変える。</span>
              </h1>
              <p className="mt-6 max-w-md text-base leading-relaxed text-text-secondary sm:text-lg">
                AIを活用して開発したツールを、無料でも有料でも公開・販売。
              </p>

              <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
                <a
                  href="/submit"
                  className="flex items-center gap-2 rounded-full bg-accent-signal px-7 py-3.5 text-[15px] font-medium text-white transition hover:brightness-110"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 16V4M12 4 7 9M12 4l5 5" />
                    <path d="M20 16.5v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2" />
                  </svg>
                  ツールを公開する
                </a>
                <a
                  href="/browse"
                  className="flex items-center gap-2 rounded-full border border-border bg-bg px-7 py-3.5 text-[15px] font-medium text-text-primary transition hover:border-border-strong hover:bg-surface"
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <circle cx="11" cy="11" r="7" />
                    <path d="m21 21-4.3-4.3" />
                  </svg>
                  マーケットを見る
                </a>
              </div>
            </div>

            <div className="mx-auto mt-24 flex max-w-2xl flex-wrap justify-center gap-x-12 gap-y-5 border-t border-border pt-9 font-mono text-sm">
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

      <Footer />
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

const FLOAT_ICON_STYLES = [
  "bg-[#16232d] text-white",
  "bg-accent-signal-dim text-accent-signal",
  "bg-accent-ai-dim text-accent-ai",
  "bg-surface-raised text-text-secondary",
];

function FloatingCard({
  tool,
  index,
  className,
  anim,
  duration,
}: {
  tool: Tool;
  index: number;
  className: string;
  anim: "float-a" | "float-b" | "float-c" | "float-d";
  duration: string;
}) {
  return (
    <a
      href={`/apps/${tool.slug}`}
      data-float
      style={{ animation: `${anim} ${duration} ease-in-out infinite` }}
      className={`absolute z-10 w-72 rounded-2xl border border-border bg-bg/95 p-5 shadow-[0_20px_45px_-16px_rgba(22,35,45,0.22)] backdrop-blur-sm transition hover:border-border-strong ${className}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg font-display text-sm font-semibold ${FLOAT_ICON_STYLES[index % FLOAT_ICON_STYLES.length]}`}
        >
          {tool.name.slice(0, 1)}
        </span>
        <span
          className={`shrink-0 rounded-full px-2 py-1 font-mono text-[10px] tracking-wide ${
            tool.runtime === "local"
              ? "bg-accent-ai-dim text-accent-ai"
              : "border border-border text-text-muted"
          }`}
        >
          {tool.runtime === "local" ? "LOCAL" : "CLOUD"}
        </span>
      </div>
      <p className="mt-3 font-display text-[16px] font-semibold leading-tight text-text-primary">
        {tool.name}
      </p>
      <p className="mt-1.5 line-clamp-2 text-[13px] leading-snug text-text-secondary">
        {tool.tagline}
      </p>
      <div className="mt-4 flex items-center justify-between font-mono text-[12px] text-text-dim">
        <span className="flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
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
