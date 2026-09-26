import { useTranslations } from "next-intl";
import { Tool, formatPrice, formatFileSize } from "@/lib/mock-data";
import { isSaleActive } from "@/lib/sale-price";
import { TOOL_LANGUAGE_NATIVE_NAMES, parseToolLanguages } from "@/lib/tool-languages";
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
        {tool.internetAccess && (
          <Row label={t("internet")} value={t(`internetValue.${tool.internetAccess}`)} />
        )}
        {parseToolLanguages(tool.uiLanguages ?? []).length > 0 && (
          <Row
            label={t("languages")}
            value={parseToolLanguages(tool.uiLanguages ?? [])
              .map((l) => (l === "other" ? t("languageOther") : TOOL_LANGUAGE_NATIVE_NAMES[l]))
              .join(" / ")}
          />
        )}
        <Row label={t("installs")} value={tool.installs.toLocaleString()} />
        <Row label={t("updatedAt")} value={tool.updatedAt} />
        {tool.runtime === "local" && formatFileSize(tool.fileSizeBytes) && (
          <Row label={t("fileSize")} value={formatFileSize(tool.fileSizeBytes)!} />
        )}
      </dl>

      {tool.isWip && (
        <div className="mt-4 rounded-lg border border-accent-ai/30 bg-accent-ai-dim px-3 py-2.5">
          <p className="flex items-center gap-1.5 text-[12px] font-medium text-accent-ai">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v4m0 12v4M4.9 4.9l2.9 2.9m8.4 8.4 2.9 2.9M2 12h4m12 0h4M4.9 19.1l2.9-2.9m8.4-8.4 2.9-2.9" />
            </svg>
            {t("wipBadge")}
          </p>
        </div>
      )}

      {!isFree && tool.refundPolicy && tool.refundPolicy !== "none" && (
        <div className="mt-4 flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
          <span className="text-[12px] text-text-muted">{t("refundPolicyTitle")}</span>
          <span className="text-[12px] font-medium text-text-secondary">
            {tool.refundPolicy === "full"
              ? t("refundPolicyFull")
              : t("refundPolicyConditional")}
          </span>
        </div>
      )}

      {tool.remixAllowed && (
        <div className="mt-4 rounded-lg border border-accent-success/30 bg-accent-success/5 px-3 py-2.5">
          <p className="flex items-center gap-1.5 text-[12px] font-medium text-accent-success">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
            </svg>
            {t("remixAllowed")}
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-text-muted">
            {t("remixAllowedHint")}
          </p>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-text-muted">{label}</dt>
      <dd className="text-right text-text-secondary">{value}</dd>
    </div>
  );
}
