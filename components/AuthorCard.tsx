import Link from "next/link";
import { useTranslations } from "next-intl";
import { Tool } from "@/lib/mock-data";

export default function AuthorCard({ tool, isDemo }: { tool: Tool; isDemo?: boolean }) {
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
