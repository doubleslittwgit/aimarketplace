"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { addToolNote, deleteToolNote } from "@/app/apps/[slug]/note-actions";

const INTL_LOCALE: Record<string, string> = { ja: "ja-JP", zh: "zh-TW", en: "en-US" };

export type ToolNoteItem = {
  id: string;
  content: string;
  created_at: string;
  author_id: string;
  profiles: { display_name: string | null; handle: string; avatar_url: string | null } | null;
};

export default function ToolNotes({
  toolId,
  slug,
  initialItems,
  isLoggedIn,
  currentUserId,
}: {
  toolId: string;
  slug: string;
  initialItems: ToolNoteItem[];
  isLoggedIn: boolean;
  currentUserId: string | null;
}) {
  const t = useTranslations("toolNotes");
  const locale = useLocale();
  const router = useRouter();

  const [items, setItems] = useState(initialItems);
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleAdd() {
    if (!isLoggedIn) {
      router.push(`/login?next=/apps/${slug}`);
      return;
    }
    setError(null);
    const content = draft.trim();
    if (!content) return;

    startTransition(async () => {
      const result = await addToolNote(toolId, slug, content);
      if (result.error) {
        setError(result.error);
        return;
      }
      setDraft("");
      setOpen(false);
      router.refresh();
    });
  }

  function handleDelete(noteId: string) {
    startTransition(async () => {
      const result = await deleteToolNote(noteId, slug);
      if (result.error) {
        setError(result.error);
        return;
      }
      setItems((prev) => prev.filter((n) => n.id !== noteId));
    });
  }

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-text-primary">
            {t("title")}
          </h2>
          <p className="mt-0.5 text-[12px] text-text-muted">{t("subtitle")}</p>
        </div>
        {!open && (
          <button
            type="button"
            onClick={() => (isLoggedIn ? setOpen(true) : router.push(`/login?next=/apps/${slug}`))}
            className="shrink-0 rounded-lg border border-border px-3.5 py-2 text-[13px] font-medium text-text-secondary transition hover:bg-surface"
          >
            {t("compose")}
          </button>
        )}
      </div>

      {open && (
        <div className="mb-5 rounded-xl border border-border bg-surface p-4">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={4}
            maxLength={1000}
            placeholder={t("placeholder")}
            className="w-full resize-none rounded-lg border border-border bg-bg px-3.5 py-2.5 text-[13px] text-text-primary outline-none focus:border-border-strong"
          />
          {error && <p className="mt-2 text-[12px] text-accent-danger">{error}</p>}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={handleAdd}
              disabled={isPending || !draft.trim()}
              className="rounded-lg bg-accent-signal px-4 py-2 text-[13px] font-medium text-white transition hover:brightness-105 disabled:opacity-60"
            >
              {isPending ? t("posting") : t("post")}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg border border-border px-4 py-2 text-[13px] text-text-secondary transition hover:bg-surface-raised"
            >
              {t("cancel")}
            </button>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border py-8 text-center text-[13px] text-text-muted">
          {t("empty")}
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((note) => (
            <div key={note.id} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  {note.profiles?.handle ? (
                    <Link
                      href={`/u/${note.profiles.handle}`}
                      className="text-[13px] font-medium text-text-primary hover:underline"
                    >
                      {note.profiles.display_name || note.profiles.handle}
                    </Link>
                  ) : (
                    <span className="text-[13px] text-text-muted">{t("unknownUser")}</span>
                  )}
                  <span className="font-mono text-[11px] text-text-dim">
                    {new Date(note.created_at).toLocaleDateString(
                      INTL_LOCALE[locale] ?? "ja-JP"
                    )}
                  </span>
                </div>
                {currentUserId === note.author_id && (
                  <button
                    type="button"
                    onClick={() => handleDelete(note.id)}
                    disabled={isPending}
                    className="shrink-0 text-[12px] text-text-dim hover:text-accent-danger"
                  >
                    {t("delete")}
                  </button>
                )}
              </div>
              <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-text-secondary">
                {note.content}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
