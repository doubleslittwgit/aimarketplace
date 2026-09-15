import Link from "next/link";
import { Tool, formatInstalls, formatPrice } from "@/lib/mock-data";

export default function ToolCard({ tool }: { tool: Tool }) {
  const isFree = tool.price === 0;

  return (
    <Link
      href={`/apps/${tool.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-surface transition hover:border-border-strong hover:bg-surface-raised"
    >
      {/* Preview area */}
      <div className="relative flex h-36 items-center justify-center overflow-hidden border-b border-border bg-gradient-to-br from-surface-raised to-bg">
        {tool.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={tool.thumbnailUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="font-display text-3xl font-semibold text-text-dim/40">
            {tool.name.slice(0, 2).toUpperCase()}
          </span>
        )}
        <span
          className={`absolute right-3 top-3 rounded-full px-2 py-0.5 font-mono text-[10px] tracking-wide ${
            tool.runtime === "local"
              ? "bg-accent-ai-dim text-accent-ai"
              : "bg-surface text-text-muted border border-border"
          }`}
        >
          {tool.runtime === "local" ? "LOCAL" : "CLOUD"}
        </span>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-[15px] font-semibold leading-tight text-text-primary">
            {tool.name}
          </h3>
          <span
            className={`shrink-0 font-mono text-[13px] font-medium ${
              isFree ? "text-text-muted" : "text-accent-signal"
            }`}
          >
            {formatPrice(tool.price)}
          </span>
        </div>
        <p className="line-clamp-2 text-[13px] leading-relaxed text-text-secondary">
          {tool.tagline}
        </p>
      </div>

      {/* Manifest strip — the signature element */}
      <div className="flex items-center justify-between border-t border-border bg-bg/40 px-4 py-2.5 font-mono text-[11px] text-text-dim">
        <span className="truncate">
          pkg://{tool.slug}
          <span className="text-text-muted">@v{tool.version}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2.5 pl-2 text-text-muted">
          {tool.likes > 0 && (
            <span className="flex items-center gap-1">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 1 0-7.8 7.8l1.1 1L12 21l7.7-7.7 1.1-1a5.5 5.5 0 0 0 0-7.8Z" />
              </svg>
              {tool.likes}
            </span>
          )}
          <span className="flex items-center gap-1">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2 2 7l10 5 10-5-10-5Z" opacity=".5" />
              <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
            {formatInstalls(tool.installs)}
          </span>
        </span>
      </div>
    </Link>
  );
}
