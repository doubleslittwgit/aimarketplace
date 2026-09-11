import Header from "@/components/Header";
import ActivityTicker from "@/components/ActivityTicker";
import ToolCard from "@/components/ToolCard";
import { tools, categories } from "@/lib/mock-data";

export default function Home() {
  return (
    <>
      <Header />
      <ActivityTicker />

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto max-w-7xl px-6 pb-14 pt-16 sm:pt-20">
          <p className="mb-4 font-mono text-[12px] tracking-wide text-accent-ai">
            $ npx forge --publish ./my-tool
          </p>
          <h1 className="max-w-3xl font-display text-[2.75rem] font-semibold leading-[1.08] tracking-tight text-text-primary sm:text-[3.5rem]">
            作ったツールを、
            <br />
            必要としている人に<span className="text-accent-signal">配送する。</span>
          </h1>
          <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-text-secondary">
            Claude Codeやカーソルで作ったAIツールを、無料でも有料でも公開できるマーケットプレイス。
            価格は0円から、あなたが決める。
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
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

          <div className="mt-14 flex flex-wrap gap-x-10 gap-y-4 border-t border-border pt-8 font-mono text-[13px]">
            <Stat label="公開ツール" value={`${tools.length * 253}+`} />
            <Stat label="開発者" value="480+" />
            <Stat label="累計ダウンロード" value="52.3k" />
            <Stat label="開発者への還元率" value="80%" accent />
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
