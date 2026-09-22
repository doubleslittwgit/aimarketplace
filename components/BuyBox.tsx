import { useTranslations } from "next-intl";
import { Tool, formatPrice, formatFileSize } from "@/lib/mock-data";
import { isSaleActive } from "@/lib/sale-price";
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
  const t = useTranslations("toolDetail.buyBox");
  const tCommon = useTranslations("common");
  const isFree = tool.price === 0;
  const isCloud = tool.runtime === "cloud";
  const onSale = isSaleActive({
    price: tool.price,
    sale_price: tool.salePrice,
    sale_ends_at: tool.saleEndsAt,
  });

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      {onSale && (
        <div className="mb-3 flex items-center gap-1.5 rounded-lg bg-accent-danger/10 px-3 py-2 text-[12px] font-medium text-accent-danger">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
            <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" />
          </svg>
          {t("saleEndsAt", {
            date: new Date(tool.saleEndsAt as string).toLocaleString(),
          })}
        </div>
      )}
      <div className="mb-4 flex items-baseline justify-between">
        {onSale ? (
          <span className="flex items-baseline gap-2">
            <span className="font-display text-2xl font-semibold text-accent-danger">
              {formatPrice(tool.salePrice as number, tCommon("free"))}
            </span>
            <span className="font-mono text-[14px] text-text-dim line-through">
              {formatPrice(tool.price, tCommon("free"))}
            </span>
          </span>
        ) : (
          <span className="font-display text-2xl font-semibold text-text-primary">
            {formatPrice(tool.price, tCommon("free"))}
          </span>
        )}
        {!isFree && (
          <span className="text-[12px] text-text-muted">{t("oneTimePurchase")}</span>
        )}
      </div>

      {isDemo ? (
        <div className="mb-3 w-full rounded-lg border border-border bg-surface-raised py-3 text-center text-sm text-text-muted">
          {t("demoNotice")}
        </div>
      ) : (
        <PurchaseButton
          toolId={tool.id}
          isFree={isFree}
          isLoggedIn={isLoggedIn}
          isOwner={isOwner}
          isPurchased={isPurchased}
          isCloud={isCloud}
        />
      )}

      <p className="mb-4 text-center text-[12px] text-text-dim">
        {isCloud
          ? isPurchased
            ? t("cloudPurchasedNotice")
            : t("cloudUnpurchasedNotice")
          : isPurchased
            ? t("purchasedNotice")
            : t("unpurchasedNotice")}
      </p>

      <dl className="space-y-2.5 border-t border-border pt-4 font-mono text-[12px]">
        <Row label={t("version")} value={`v${tool.version}`} />
        <Row
          label={t("runtime")}
          value={tool.runtime === "local" ? t("runtimeLocal") : t("runtimeCloud")}
        />
        <Row label={t("installs")} value={tool.installs.toLocaleString()} />
        <Row label={t("updatedAt")} value={tool.updatedAt} />
        {tool.runtime === "local" && formatFileSize(tool.fileSizeBytes) && (
          <Row label={t("fileSize")} value={formatFileSize(tool.fileSizeBytes)!} />
        )}
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
