import Link from "next/link";
import { useTranslations } from "next-intl";
import { Tool } from "@/lib/mock-data";

/**
 * 商品ページの「開発者」カード。
 *
 * verified は、出品者がStripeでの本人確認と売上の受け取り設定を完了しているか。
 * Stripeは受け取り設定の過程で公的な身分証による本人確認を行うため、
 * これを「本人確認済み」の根拠にしている（メルカリの本人確認バッジと同じ考え方）。
 * 判定元の seller_accounts は非公開なので、ページ側で真偽だけを受け取る。
 */
export default function AuthorCard({
  tool,
  isDemo,
  verified,
}: {
  tool: Tool;
  isDemo?: boolean;
  verified?: boolean;
}) {
  const t = useTranslations("toolDetail.authorCard");
  const initials = tool.author.name
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2);
  // tool.author.handle は "@handle" の形（無ければ空文字）で保持しているため、
  // リンク先を組み立てるには先頭の @ を外す必要がある。
  const rawHandle = tool.author.handle.replace(/^@/, "");
  const href = !isDemo && rawHandle ? `/u/${rawHandle}` : null;

  const content = (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-ai-dim font-display text-[13px] font-semibold text-accent-ai">
        {initials}
      </div>
      <div className="min-w-0">
        <p className="truncate text-[14px] font-medium text-text-primary">
          {tool.author.name}
        </p>
        <p className="truncate text-[12px] text-text-muted">
          {tool.author.handle}
        </p>
        {verified && (
          <span
            title={t("verifiedHint")}
            className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-accent-success/10 px-2 py-0.5 text-[11px] font-medium text-accent-success"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M12 2 3 6v6c0 5 3.8 9.3 9 10 5.2-.7 9-5 9-10V6l-9-4Zm-1.2 14.2-3.6-3.6 1.4-1.4 2.2 2.2 5-5 1.4 1.4-6.4 6.4Z" />
            </svg>
            {t("verified")}
          </span>
        )}
      </div>
    </div>
  );

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <p className="mb-3 text-[12px] font-medium uppercase tracking-wide text-text-muted">
        {t("label")}
      </p>
      {href ? (
        <Link href={href} className="block transition hover:opacity-80">
          {content}
        </Link>
      ) : (
        content
      )}
    </div>
  );
}
