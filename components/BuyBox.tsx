import { Tool, formatPrice } from "@/lib/mock-data";

export default function BuyBox({ tool }: { tool: Tool }) {
  const isFree = tool.price === 0;

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <span className="font-display text-2xl font-semibold text-text-primary">
          {formatPrice(tool.price)}
        </span>
        {!isFree && (
          <span className="text-[12px] text-text-muted">買い切り・永続利用</span>
        )}
      </div>

      <button
        type="button"
        className="mb-3 w-full rounded-lg bg-accent-signal py-3 text-sm font-medium text-white transition hover:brightness-105"
      >
        {isFree ? "無料でダウンロード" : "購入してダウンロード"}
      </button>

      <p className="mb-4 text-center text-[12px] text-text-dim">
        購入後、すぐにダウンロードできます
      </p>

      <dl className="space-y-2.5 border-t border-border pt-4 font-mono text-[12px]">
        <Row label="バージョン" value={`v${tool.version}`} />
        <Row
          label="実行環境"
          value={tool.runtime === "local" ? "ローカル実行" : "クラウド(Web)"}
        />
        <Row label="インストール数" value={tool.installs.toLocaleString()} />
        <Row label="最終更新" value={tool.updatedAt} />
      </dl>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-text-muted">{label}</dt>
      <dd className="text-text-secondary">{value}</dd>
    </div>
  );
}
