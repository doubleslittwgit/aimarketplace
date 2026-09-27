"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

const CODES = ["not_purchased", "not_ready", "no_file", "failed"] as const;
type Code = (typeof CODES)[number];

/**
 * ダウンロード・利用開始に失敗したときの案内。
 * ダウンロードの窓口（app/apps/download/[toolId]/route.ts）は失敗すると
 * 商品ページへ ?download_error=… を付けて戻すので、それを読んで翻訳済みの文言を出す。
 */
export default function DownloadErrorNotice() {
  const t = useTranslations("toolDetail.downloadError");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const raw = searchParams.get("download_error");
  const [code, setCode] = useState<Code | null>(() =>
    raw && (CODES as readonly string[]).includes(raw) ? (raw as Code) : raw ? "failed" : null
  );

  if (!code) return null;

  function close() {
    setCode(null);
    // ?download_error だけを消す（他の表示用のパラメータは残す）
    const rest = new URLSearchParams(searchParams.toString());
    rest.delete("download_error");
    const query = rest.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <div
      role="alert"
      className="fixed inset-x-3 top-20 z-50 mx-auto flex max-w-lg items-start gap-3 rounded-xl border border-accent-danger/30 bg-[#fdf0ee] px-4 py-3 text-[13px] text-accent-danger shadow-lg"
    >
      <p className="flex-1 leading-relaxed">{t(code)}</p>
      <button type="button" onClick={close} aria-label={t("close")} className="shrink-0 px-1 text-[16px] leading-none">
        ×
      </button>
    </div>
  );
}
