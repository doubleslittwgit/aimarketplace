import { Tool, formatPrice } from "@/lib/mock-data";
import PurchaseButton from "@/components/PurchaseButton";

type Props = {
  tool: Tool;
  isLoggedIn: boolean;
  isOwner: boolean;
  isPurchased: boolean;
  /** モックデータ（デモ用のサンプル）の場合は購入処理を無効にする */
  isDemo?: boolean;
};

export default function BuyBox({
  tool,
  isLoggedIn,
  isOwner,
  isPurchased,
  isDemo,
}: Props) {
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

      {isDemo ? (
        <div className="mb-3 w-full rounded-lg border border-border bg-surface-raised py-3 text-center text-sm text-text-muted">
          サンプル表示のため購入できません
        </div>
      ) : (
        <PurchaseButton
          toolId={tool.id}
          isFree={isFree}
          isLoggedIn={isLoggedIn}
          isOwner={isOwner}
          isPurchased={isPurchased}
        />
      )}

      <p className="mb-4 text-center text-[12px] text-text-dim">
        {isPurchased
          ? "購入済みです。いつでもダウンロードできます"
          : "購入後、すぐにダウンロードできます"}
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
