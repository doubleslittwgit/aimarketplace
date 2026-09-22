import Link from "next/link";

export default function CreativeHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0a0a14]/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center gap-6 px-6 py-3.5">
        <Link href="/creative" className="flex shrink-0 items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 font-display text-[13px] font-bold text-white">
            B
          </span>
          <span className="font-display text-[16px] font-bold text-white">
            BuildBay <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">Creative</span>
          </span>
        </Link>

        <Link
          href="/browse"
          className="hidden min-w-0 flex-1 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[13px] text-white/40 transition hover:border-white/20 sm:flex"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          プラグイン・ツール・クリエイターを検索...
        </Link>

        <nav className="ml-auto hidden items-center gap-6 text-[13px] font-medium text-white/70 lg:flex">
          <Link href="/creative" className="transition hover:text-white">
            Discover
          </Link>
          <Link href="/browse" className="transition hover:text-white">
            Categories
          </Link>
          <Link href="/creative#featured" className="transition hover:text-white">
            Featured
          </Link>
        </nav>

        <Link
          href="/submit"
          className="shrink-0 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 px-4 py-2 text-[13px] font-medium text-white transition hover:brightness-110"
        >
          プラグインを公開
        </Link>
      </div>
    </header>
  );
}
