import Link from "next/link";

/**
 * 全ページ共通のフッター。
 * 以前は page.tsx / browse / apps[slug] にそれぞれ同じ内容が
 * ベタ書きされており、ブランド名やリンクを直すたびに
 * 3箇所修正する必要があった。ここに集約している。
 */
export default function Footer({ width = "max-w-7xl" }: { width?: string }) {
  return (
    <footer className="border-t border-border">
      <div className={`mx-auto ${width} px-6 py-10 text-[13px] text-text-dim`}>
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <span className="font-display font-semibold text-text-muted">
              BuildBay
            </span>
            <p className="mt-1.5 text-text-dim">
              AIで生まれたツールが集まる港。
            </p>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <Link href="/legal/terms" className="hover:text-text-secondary">
              利用規約
            </Link>
            <Link href="/legal/privacy" className="hover:text-text-secondary">
              プライバシーポリシー
            </Link>
            <Link href="/legal/tokushoho" className="hover:text-text-secondary">
              特定商取引法に基づく表記
            </Link>
            <Link href="/legal/contact" className="hover:text-text-secondary">
              お問い合わせ
            </Link>
          </div>
        </div>

        <p className="mt-8 font-mono text-[12px] text-text-dim">
          © {new Date().getFullYear()} BuildBay
        </p>
      </div>
    </footer>
  );
}
