import Link from "next/link";
import { useTranslations } from "next-intl";
import { Tool, formatInstalls, formatPrice } from "@/lib/mock-data";
import { categoryToSlug } from "@/lib/category-slugs";
import { isSaleActive } from "@/lib/sale-price";
import RuntimeBadge from "@/components/RuntimeBadge";
import { ApproxPrice } from "@/components/CurrencyProvider";

export default function ToolCard({ tool }: { tool: Tool }) {
  const t = useTranslations();
  const isFree = tool.price === 0;
  const onSale = isSaleActive({
    price: tool.price,
    sale_price: tool.salePrice,
    sale_ends_at: tool.saleEndsAt,
  });
  const initials = tool.author.name
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2);

  return (
    <Link
      href={`/apps/${tool.slug}`}
      className="card-lift group flex flex-col overflow-hidden rounded-xl border border-border bg-surface hover:border-border-strong hover:bg-surface-raised"
    >
      {/* Preview area */}
      <div className="relative aspect-video overflow-hidden border-b border-border bg-gradient-to-br from-surface-raised to-bg">
        {tool.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={tool.thumbnailUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center font-display text-3xl font-semibold text-text-dim/40">
            {tool.name.slice(0, 2).toUpperCase()}
          </span>
        )}
        {/* 提供形態（クラウド／ローカル）。買う前に大事な情報なので右上に大きめに出す */}
        <RuntimeBadge runtime={tool.runtime} className="absolute right-3 top-3 z-10" />

        {/* セール・開発中の表示と、入手実績バッジ（インストール数・いいね数・閲覧数）。
            重ならないよう、同じ行に左から順に並べる */}
        <div className="absolute left-3 right-24 top-3 flex flex-wrap items-center gap-1.5">
          {onSale && (
            <span className="rounded-full bg-accent-danger px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wide text-white shadow-sm">
              SALE
            </span>
          )}
          {tool.isWip && !onSale && (
            <span className="rounded-full bg-accent-ai px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm">
              {t("toolDetail.buyBox.wipBadge")}
            </span>
          )}
          <span className="flex items-center gap-1 rounded-full bg-bg/90 px-2 py-0.5 text-[11px] font-medium text-text-secondary shadow-sm backdrop-blur-sm">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent-ai">
              <path d="M12 3v12" />
              <path d="m7 10 5 5 5-5" />
              <path d="M5 21h14" />
            </svg>
            {formatInstalls(tool.installs)}
          </span>
          {tool.likes > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-bg/90 px-2 py-0.5 text-[11px] font-medium text-text-secondary shadow-sm backdrop-blur-sm">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" className="text-accent-signal">
                <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 1 0-7.8 7.8l1.1 1L12 21l7.7-7.7 1.1-1a5.5 5.5 0 0 0 0-7.8Z" />
              </svg>
              {tool.likes}
            </span>
          )}
          <span className="flex items-center gap-1 rounded-full bg-bg/90 px-2 py-0.5 text-[11px] font-medium text-text-secondary shadow-sm backdrop-blur-sm">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted">
              <path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" />
              <circle cx="12" cy="12" r="2.5" />
            </svg>
            {formatInstalls(tool.views)}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-[15px] font-semibold leading-tight text-text-primary">
            {tool.name}
          </h3>
          {onSale ? (
            <span className="flex shrink-0 flex-col items-end font-mono text-[13px] font-medium">
              <span className="text-[11px] text-text-dim line-through">
                {formatPrice(tool.price, t("common.free"))}
              </span>
              <span className="text-accent-danger">
                {formatPrice(tool.salePrice as number, t("common.free"))}
              </span>
              <ApproxPrice yen={tool.salePrice as number} className="font-sans text-[11px] font-normal text-text-muted" />
            </span>
          ) : (
            <span className="flex shrink-0 flex-col items-end">
              <span
                className={`font-mono text-[13px] font-medium ${
                  isFree ? "text-text-muted" : "text-accent-signal"
                }`}
              >
                {formatPrice(tool.price, t("common.free"))}
              </span>
              <ApproxPrice yen={tool.price} className="text-[11px] text-text-muted" />
            </span>
          )}
        </div>
        <p className="line-clamp-2 text-[13px] leading-relaxed text-text-secondary">
          {tool.tagline}
        </p>

        {/* 評価（レビューがあるときだけ） */}
        {(tool.ratingCount ?? 0) > 0 && (
          <p className="flex items-center gap-1 text-[12px] text-text-secondary">
            <span className="text-[#f5a623]" aria-hidden>★</span>
            <span className="font-semibold">{(tool.ratingAvg ?? 0).toFixed(1)}</span>
            <span className="text-text-dim">({tool.ratingCount})</span>
          </p>
        )}

        {/* カテゴリ */}
        {tool.categories.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            {tool.categories.slice(0, 2).map((c) => (
              <span
                key={c}
                className="rounded-full bg-surface-raised px-2 py-0.5 text-[10px] text-text-muted"
              >
                {t(`categories.${categoryToSlug(c)}`)}
              </span>
            ))}
            {tool.categories.length > 2 && (
              <span className="text-[10px] text-text-dim">
                +{tool.categories.length - 2}
              </span>
            )}
          </div>
        )}

        {/* 出品者 */}
        <div className="mt-1 flex items-center gap-1.5">
          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-ai-dim text-[9px] font-semibold text-accent-ai">
            {initials}
          </div>
          <span className="truncate text-[12px] text-text-muted">{tool.author.name}</span>
        </div>
      </div>
    </Link>
  );
}
