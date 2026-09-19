import Link from "next/link";
import { useTranslations } from "next-intl";

/**
 * 全ページ共通のフッター。
 * 以前は page.tsx / browse / apps[slug] にそれぞれ同じ内容が
 * ベタ書きされており、ブランド名やリンクを直すたびに
 * 3箇所修正する必要があった。ここに集約している。
 */
export default function Footer({ width = "max-w-7xl" }: { width?: string }) {
  const t = useTranslations("footer");

  return (
    <footer className="border-t border-border">
      <div className={`mx-auto ${width} px-6 py-10 text-[13px] text-text-dim`}>
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <span className="font-display font-semibold text-text-muted">
              BuildBay
            </span>
            <p className="mt-1.5 text-text-dim">{t("tagline")}</p>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <Link href="/legal/terms" className="hover:text-text-secondary">
              {t("terms")}
            </Link>
            <Link href="/legal/privacy" className="hover:text-text-secondary">
              {t("privacy")}
            </Link>
            <Link href="/legal/tokushoho" className="hover:text-text-secondary">
              {t("tokushoho")}
            </Link>
            <Link href="/legal/contact" className="hover:text-text-secondary">
              {t("contact")}
            </Link>
          </div>
        </div>

        <p className="mt-8 font-mono text-[12px] text-text-dim">
          {t("copyright", { year: new Date().getFullYear() })}
        </p>
      </div>
    </footer>
  );
}
