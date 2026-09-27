import Link from "next/link";
import { getTranslations } from "next-intl/server";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

/**
 * 「ページが見つかりません」画面（存在しないURL・非公開のツールや講座・退会したユーザーなど）。
 * Next.jsの標準の画面だと、BuildBayの中にいることが分からず、そのまま離脱されやすいため、
 * ヘッダー・ロゴと、次に行ける場所（トップ・ツール一覧・Academy）を出す。
 */
export default async function NotFound() {
  const t = await getTranslations("notFound");
  return (
    <>
      <Header />
      <main className="relative flex flex-1 items-center overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 left-[15%] h-80 w-80 rounded-full bg-accent-ai/15 blur-[110px]" />
          <div className="absolute bottom-[-6rem] right-[12%] h-80 w-80 rounded-full bg-accent-signal/10 blur-[110px]" />
        </div>
        <div className="relative mx-auto flex max-w-xl flex-col items-center px-6 py-20 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon-512.png" alt="" width={512} height={512} className="h-20 w-20 opacity-90" />
          <p className="mt-6 font-mono text-[13px] tracking-widest text-text-dim">404</p>
          <h1 className="mt-2 font-display text-2xl font-semibold text-text-primary sm:text-3xl">{t("title")}</h1>
          <p className="mt-3 text-[14px] leading-relaxed text-text-secondary">{t("body")}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/"
              className="rounded-full bg-accent-signal px-6 py-2.5 text-[14px] font-medium text-white transition hover:brightness-110"
            >
              {t("home")}
            </Link>
            <Link
              href="/browse"
              className="rounded-full border border-border bg-bg px-6 py-2.5 text-[14px] font-medium text-text-primary transition hover:bg-surface"
            >
              {t("browse")}
            </Link>
            <Link
              href="/academy"
              className="rounded-full border border-border bg-bg px-6 py-2.5 text-[14px] font-medium text-text-primary transition hover:bg-surface"
            >
              {t("academy")}
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
