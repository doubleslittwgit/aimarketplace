import Link from "next/link";
import { getTranslations } from "next-intl/server";

/**
 * BuildBay Academy 共通のヘッダーとフッター。
 * トップページと講座ページで同じものを使い、Academyの中を移動しても
 * 「同じ場所にいる」と感じられるようにする。
 */

export function AcIcon({ d, size = 20 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

export const AC_BOOK = "M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14zM20 17v4H6.5a2.5 2.5 0 0 1 0-5";

export async function AcademyHeader({ q = "", isLoggedIn }: { q?: string; isLoggedIn: boolean }) {
  const t = await getTranslations("academyHome");
  const writeHref = isLoggedIn ? "/academy/new" : "/login?next=/academy/new";
  const user = isLoggedIn;
  const Icon = AcIcon;
  const BOOK = AC_BOOK;
  return (
    <header className="sticky top-0 z-40 border-b border-[#E6DFCC] bg-[#F7F3E8]/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
        <Link href="/academy" className="flex shrink-0 items-center gap-2 text-[#173F35]">
          <span className="text-[#C9A227]">
            <Icon d={BOOK} size={26} />
          </span>
          <span className="leading-tight">
            <span className="ac-serif block text-[18px] font-bold">BuildBay Academy</span>
            <span className="block text-[10px] tracking-wide text-[#5E6A62]">{t("tagline")}</span>
          </span>
        </Link>

        <nav className="ml-4 hidden items-center gap-5 text-[13px] text-[#34463D] lg:flex">
          <a href="/academy#courses" className="hover:text-[#173F35]">{t("nav.browse")}</a>
          <a href="/academy#categories" className="hover:text-[#173F35]">{t("nav.categories")}</a>
          <a href="/academy#makers" className="hover:text-[#173F35]">{t("nav.makers")}</a>
        </nav>

        <form action="/academy" method="get" className="ml-auto hidden max-w-sm flex-1 md:block">
          <label className="flex items-center gap-2 rounded-full border border-[#E6DFCC] bg-white px-4 py-2">
            <span className="text-[#8A8F84]">
              <Icon d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3" size={16} />
            </span>
            <input
              name="q"
              defaultValue={q}
              placeholder={t("searchPlaceholder")}
              className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-[#9AA098]"
            />
          </label>
        </form>

        <div className="ml-auto flex shrink-0 items-center gap-3 md:ml-0">
          <Link href="/" className="hidden text-[12px] text-[#5E6A62] hover:text-[#173F35] sm:inline">
            {t("nav.backToBuildBay")}
          </Link>
          {!user && (
            <Link href="/login?next=/academy" className="text-[13px] text-[#34463D] hover:text-[#173F35]">
              {t("login")}
            </Link>
          )}
          <Link
            href={writeHref}
            className="rounded-lg bg-[#C9A227] px-4 py-2 text-[13px] font-semibold text-white shadow-sm transition hover:brightness-105"
          >
            {t("write")}
          </Link>
        </div>
      </div>
    </header>
  );
}

export async function AcademyFooter({ isLoggedIn }: { isLoggedIn: boolean }) {
  const t = await getTranslations("academyHome");
  const writeHref = isLoggedIn ? "/academy/new" : "/login?next=/academy/new";
  const Icon = AcIcon;
  const BOOK = AC_BOOK;
  return (
    <footer className="bg-[#173F35] text-[#F7F3E8]">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-10 sm:px-6 md:flex-row md:justify-between">
        <div>
          <p className="ac-serif flex items-center gap-2 text-[18px] font-bold">
            <span className="text-[#C9A227]">
              <Icon d={BOOK} size={22} />
            </span>
            BuildBay Academy
          </p>
          <p className="mt-1 text-[12px] text-[#F7F3E8]/70">{t("tagline")}</p>
        </div>
        <div className="grid grid-cols-2 gap-x-12 gap-y-2 text-[12px] text-[#F7F3E8]/80">
          <a href="/academy#courses" className="hover:text-white">{t("nav.browse")}</a>
          <Link href="/legal/terms" className="hover:text-white">{t("footer.terms")}</Link>
          <Link href={writeHref} className="hover:text-white">{t("write")}</Link>
          <Link href="/legal/privacy" className="hover:text-white">{t("footer.privacy")}</Link>
          <Link href="/" className="hover:text-white">{t("nav.backToBuildBay")}</Link>
          <Link href="/legal/tokushoho" className="hover:text-white">{t("footer.tokushoho")}</Link>
          <span />
          <Link href="/legal/contact" className="hover:text-white">{t("footer.contact")}</Link>
        </div>
      </div>
    </footer>
  );
}
