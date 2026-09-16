import Link from "next/link";
import { Tool, formatInstalls, formatPrice } from "@/lib/mock-data";

export default function ToolCard({ tool }: { tool: Tool }) {
  const isFree = tool.price === 0;
  const initials = tool.author.name
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2);

  return (
    <Link
      href={`/apps/${tool.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-surface transition hover:border-border-strong hover:bg-surface-raised"
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
        <span
          className={`absolute right-3 top-3 rounded-full px-2 py-0.5 font-mono text-[10px] tracking-wide ${
            tool.runtime === "local"
              ? "bg-accent-ai-dim text-accent-ai"
              : "bg-surface text-text-muted border border-border"
          }`}
        >
          {tool.runtime === "local" ? "LOCAL" : "CLOUD"}
        </span>

        {/* 入手実績バッジ（インストール数・いいね数・閲覧数） */}
        <div className="absolute left-3 top-3 flex items-center gap-1.5">
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
          {tool.views > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-bg/90 px-2 py-0.5 text-[11px] font-medium text-text-secondary shadow-sm backdrop-blur-sm">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted">
                <path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" />
                <circle cx="12" cy="12" r="2.5" />
              </svg>
              {formatInstalls(tool.views)}
            </span>
          )}
        </div>
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
