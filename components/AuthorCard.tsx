import { useTranslations } from "next-intl";
import { Tool } from "@/lib/mock-data";

export default function AuthorCard({ tool }: { tool: Tool }) {
  const t = useTranslations("toolDetail.authorCard");
  const initials = tool.author.name
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2);

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <p className="mb-3 text-[12px] font-medium uppercase tracking-wide text-text-muted">
        {t("label")}
      </p>
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
    </div>
  );
}
