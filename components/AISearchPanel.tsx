"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import ToolCard from "@/components/ToolCard";
import { aiSearchTools } from "@/app/browse/ai-search-actions";
import type { Tool } from "@/lib/mock-data";

export default function AISearchPanel() {
  const t = useTranslations("aiSearch");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<(Tool & { aiReason: string })[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await aiSearchTools(query);
      if (result.error) {
        setError(result.error);
        setResults(null);
        return;
      }
      setResults(result.tools);
    });
  }

  return (
    <div className="mb-8 rounded-xl border border-border bg-surface p-5">
      <div className="flex items-center gap-2">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent-ai">
          <path d="M12 3v3m0 12v3m9-9h-3M6 12H3m14.5-6.5-2 2m-9 9-2 2m13-2-2-2m-9-9-2-2" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        <h2 className="font-display text-[15px] font-semibold text-text-primary">{t("title")}</h2>
      </div>
      <p className="mt-1 text-[12px] text-text-muted">{t("subtitle")}</p>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder={t("placeholder")}
          rows={2}
          maxLength={300}
          className="flex-1 resize-none rounded-lg border border-border bg-bg px-3.5 py-2.5 text-[13px] text-text-primary outline-none placeholder:text-text-dim focus:border-border-strong"
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending || !query.trim()}
          className="shrink-0 rounded-lg bg-accent-ai px-5 py-2.5 text-[13px] font-medium text-white transition hover:brightness-105 disabled:opacity-50 sm:self-start"
        >
          {isPending ? t("searching") : t("submitButton")}
        </button>
      </div>

      {error && <p className="mt-2 text-[12px] text-accent-danger">{error}</p>}

      {results !== null && (
        <div className="mt-5 border-t border-border pt-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[12px] font-medium text-text-muted">{t("resultsTitle")}</p>
            <button
              type="button"
              onClick={() => setResults(null)}
              className="text-[12px] text-text-dim hover:text-text-primary"
            >
              {t("clear")}
            </button>
          </div>
          {results.length === 0 ? (
            <p className="text-[13px] text-text-muted">{t("noResults")}</p>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {results.map((tool) => (
                <div key={tool.id}>
                  <ToolCard tool={tool} />
                  {tool.aiReason && (
                    <p className="mt-1.5 flex items-start gap-1 text-[11px] text-accent-ai">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
                        <path d="M12 3v3m0 12v3m9-9h-3M6 12H3m14.5-6.5-2 2m-9 9-2 2m13-2-2-2m-9-9-2-2" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                      {tool.aiReason}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
