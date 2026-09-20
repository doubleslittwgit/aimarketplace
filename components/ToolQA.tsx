"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { askQuestion, answerQuestion, type QAItem } from "@/app/apps/[slug]/qa-actions";

const INTL_LOCALE: Record<string, string> = { ja: "ja-JP", zh: "zh-TW", en: "en-US" };

export default function ToolQA({
  toolId,
  slug,
  initialItems,
  isLoggedIn,
  isOwner,
}: {
  toolId: string;
  slug: string;
  initialItems: QAItem[];
  isLoggedIn: boolean;
  isOwner: boolean;
}) {
  const t = useTranslations("qa");
  const locale = useLocale();
  const router = useRouter();

  const [items, setItems] = useState(initialItems);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleAsk() {
    if (!isLoggedIn) {
      router.push(`/login?next=/apps/${slug}`);
      return;
    }
    setError(null);
    const question = draft.trim();
    if (!question) return;
    startTransition(async () => {
      const result = await askQuestion(toolId, slug, question);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.item) {
        setItems((prev) => [result.item!, ...prev]);
        setDraft("");
      }
    });
  }

  function handleAnswered(questionId: string, answer: string) {
    setItems((prev) =>
      prev.map((item) =>
        item.id === questionId
          ? { ...item, answer, answered_at: new Date().toISOString() }
          : item
      )
    );
  }

  return (
    <section id="qa" className="scroll-mt-20 rounded-xl border border-border bg-surface p-5">
      <h2 className="font-display text-lg font-semibold text-text-primary">{t("title")}</h2>
      <p className="mt-1 text-[13px] text-text-muted">{t("subtitle")}</p>

      {!isOwner && (
        <div className="mt-4">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t("askPlaceholder")}
            rows={2}
            maxLength={500}
            className="w-full resize-none rounded-lg border border-border bg-bg px-3.5 py-2.5 text-[13px] text-text-primary outline-none placeholder:text-text-dim focus:border-border-strong"
          />
          {error && <p className="mt-1.5 text-[12px] text-accent-danger">{error}</p>}
          <div className="mt-2 flex items-center justify-between">
            {!isLoggedIn && <p className="text-[12px] text-text-dim">{t("askLoginPrompt")}</p>}
            <button
              type="button"
              onClick={handleAsk}
              disabled={isPending || !draft.trim()}
              className="ml-auto rounded-lg bg-accent-signal px-4 py-2 text-[13px] font-medium text-white transition hover:brightness-105 disabled:opacity-50"
            >
              {isPending ? t("asking") : t("askButton")}
            </button>
          </div>
        </div>
      )}

      <div className="mt-5 space-y-4 border-t border-border pt-4">
        {items.length === 0 ? (
          <p className="text-[13px] text-text-muted">
            {isOwner ? t("noQuestionsOwner") : t("noQuestionsAsker")}
          </p>
        ) : (
          items.map((item) => (
            <QARow
              key={item.id}
              item={item}
              slug={slug}
              isOwner={isOwner}
              onAnswered={handleAnswered}
              locale={locale}
            />
          ))
        )}
      </div>
    </section>
  );
}

function QARow({
  item,
  slug,
  isOwner,
  onAnswered,
  locale,
}: {
  item: QAItem;
  slug: string;
  isOwner: boolean;
  onAnswered: (questionId: string, answer: string) => void;
  locale: string;
}) {
  const t = useTranslations("qa");
  const [answering, setAnswering] = useState(false);
  const [answerDraft, setAnswerDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submitAnswer() {
    setError(null);
    const answer = answerDraft.trim();
    if (!answer) return;
    startTransition(async () => {
      const result = await answerQuestion(item.id, slug, answer);
      if (result.error) {
        setError(result.error);
        return;
      }
      onAnswered(item.id, answer);
      setAnswering(false);
      setAnswerDraft("");
    });
  }

  return (
    <div className="rounded-lg border border-border bg-bg p-3.5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13px] text-text-primary">{item.question}</p>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] ${
            item.answer
              ? "bg-accent-success/10 text-accent-success"
              : "bg-surface-raised text-text-muted"
          }`}
        >
          {item.answer ? t("answered") : t("unanswered")}
        </span>
      </div>
      <p className="mt-1 font-mono text-[11px] text-text-dim">
        {item.asker.display_name || t("unnamedUser")} ・{" "}
        {new Date(item.created_at).toLocaleDateString(INTL_LOCALE[locale] ?? "ja-JP")}
      </p>

      {item.answer && (
        <div className="mt-2.5 rounded-lg bg-accent-signal-dim px-3 py-2">
          <p className="mb-0.5 text-[11px] font-medium text-accent-signal">{t("answerLabel")}</p>
          <p className="text-[13px] text-text-secondary">{item.answer}</p>
        </div>
      )}

      {isOwner && !item.answer && (
        <div className="mt-2.5">
          {answering ? (
            <div>
              <textarea
                value={answerDraft}
                onChange={(e) => setAnswerDraft(e.target.value)}
                placeholder={t("answerPlaceholder")}
                rows={2}
                maxLength={500}
                className="w-full resize-none rounded-lg border border-border bg-surface px-3 py-2 text-[13px] text-text-primary outline-none placeholder:text-text-dim focus:border-border-strong"
              />
              {error && <p className="mt-1 text-[12px] text-accent-danger">{error}</p>}
              <div className="mt-1.5 flex gap-2">
                <button
                  type="button"
                  onClick={submitAnswer}
                  disabled={isPending || !answerDraft.trim()}
                  className="rounded-lg bg-accent-signal px-3.5 py-1.5 text-[12px] font-medium text-white transition hover:brightness-105 disabled:opacity-50"
                >
                  {isPending ? t("answering") : t("answerButton")}
                </button>
                <button
                  type="button"
                  onClick={() => setAnswering(false)}
                  className="rounded-lg border border-border px-3.5 py-1.5 text-[12px] text-text-secondary hover:bg-surface"
                >
                  {t("cancel")}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAnswering(true)}
              className="text-[12px] font-medium text-accent-signal hover:underline"
            >
              {t("answerAsSeller")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
