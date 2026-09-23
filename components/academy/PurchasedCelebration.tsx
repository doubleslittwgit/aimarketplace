"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import AcademyCelebration from "@/components/academy/AcademyCelebration";

/**
 * 講座を購入してStripeから戻ってきた直後の演出。
 * 支払いの確認（Webhook）が済んでいる時だけ、講座ページから表示される。
 */
export default function PurchasedCelebration() {
  const t = useTranslations("academyCourse.celebrate");
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(true);
  if (!open) return null;

  return (
    <AcademyCelebration
      title={t("title")}
      body={t("body")}
      primary={{ label: t("read") }}
      secondary={{ label: t("toDashboard"), href: "/dashboard" }}
      onClose={() => {
        setOpen(false);
        // ?purchased=1 を消す（残すと再読み込みのたびに演出が出る）
        router.replace(pathname);
      }}
    />
  );
}
