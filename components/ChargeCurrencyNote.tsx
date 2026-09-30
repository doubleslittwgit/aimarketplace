"use client";

import { useTranslations } from "next-intl";
import { useDisplayCurrency } from "@/components/CurrencyProvider";
import { formatConverted } from "@/lib/currency/config";

/**
 * 購入ボタンの近くに出す、現地の通貨での目安と「お支払いは日本円」の案内。
 * 表示通貨が日本円のときは何も出さない。
 *
 * 目安の金額だけを見て買うと、カードの請求額（カード会社のレートで換算・手数料がかかることもある）
 * との差に驚かれるため、請求は円であることを必ず一緒に書く。
 */
export default function ChargeCurrencyNote({ yen, className = "" }: { yen: number; className?: string }) {
  const { currency, rate } = useDisplayCurrency();
  const t = useTranslations("currency");
  if (currency === "JPY" || !(yen > 0)) return null;
  return (
    <div className={`rounded-lg bg-surface-raised px-3 py-2 ${className}`}>
      <p className="text-[14px] font-semibold text-text-primary">
        {t("approx", { amount: formatConverted(yen, currency, rate) })}
      </p>
      <p className="mt-0.5 text-[11px] leading-relaxed text-text-muted">
        {t("chargedInYen", { price: `¥${yen.toLocaleString()}` })}
      </p>
    </div>
  );
}
