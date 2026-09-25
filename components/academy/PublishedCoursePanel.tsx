"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { COURSE_CATEGORIES } from "@/lib/academy/categories";
import { quickEditCourse, setCourseVisibility, duplicateCourse } from "@/app/academy/published-actions";

/**
 * 公開中（・非公開中）の講座の管理画面。
 * 本文の編集画面の代わりに表示する。公開後に変えられるのは
 * 価格（有料の範囲内）・カテゴリ・販売部数の上限・公開/非公開だけ。
 */
export default function PublishedCoursePanel({
  course,
  soldCount,
}: {
  course: {
    id: string;
    slug: string;
    title: string;
    thumbnailUrl: string | null;
    price: number;
    category: string | null;
    salesLimit: number | null;
    status: "published" | "suspended";
  };
  soldCount: number;
}) {
  const t = useTranslations("academyPublished");
  const tEditor = useTranslations("academyEditor");
  const tHome = useTranslations("academyHome");
  const router = useRouter();
  const isFree = course.price === 0;

  const [price, setPrice] = useState(String(course.price));
  const [category, setCategory] = useState(course.category ?? "");
  const [salesLimit, setSalesLimit] = useState(course.salesLimit ? String(course.salesLimit) : "");
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const visible = course.status === "published";

  function saveQuickEdit() {
    setMessage(null);
    startTransition(async () => {
      const result = await quickEditCourse({
        courseId: course.id,
        price: isFree ? 0 : Number(price),
        category: category || null,
        salesLimit: isFree || salesLimit.trim() === "" ? null : Number(salesLimit),
      });
      setMessage(result.error ? { kind: "error", text: result.error } : { kind: "ok", text: t("saved") });
      if (!result.error) router.refresh();
    });
  }

  function toggleVisibility() {
    if (!window.confirm(visible ? t("confirmHide") : t("confirmShow"))) return;
    setMessage(null);
    startTransition(async () => {
      const result = await setCourseVisibility(course.id, !visible);
      if (result.error) setMessage({ kind: "error", text: result.error });
      else router.refresh();
    });
  }

  function makeRevision() {
    if (!window.confirm(t("confirmRevision"))) return;
    setMessage(null);
    startTransition(async () => {
      const result = await duplicateCourse(course.id);
      if (result.error !== null) setMessage({ kind: "error", text: result.error });
      else router.push(`/academy/${result.id}/edit`);
    });
  }

  const remaining = course.salesLimit !== null ? Math.max(course.salesLimit - soldCount, 0) : null;

  return (
    <div className="min-h-screen bg-bg">
      <div className="sticky top-0 z-40 border-b border-border bg-bg/95 backdrop-blur">
        <div className="flex h-14 items-center gap-3 px-4">
          <Link href="/dashboard" className="shrink-0 text-[13px] text-text-muted hover:text-text-primary">
            ← {tEditor("back")}
          </Link>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
              visible ? "bg-accent-success/10 text-accent-success" : "bg-surface-raised text-text-muted"
            }`}
          >
            {visible ? t("statusPublished") : t("statusHidden")}
          </span>
          <Link
            href={`/academy/courses/${course.slug}`}
            className="ml-auto shrink-0 rounded-lg border border-border px-3 py-1.5 text-[13px] text-text-secondary hover:bg-surface"
          >
            {t("viewPage")}
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-2xl space-y-5 px-4 pb-24 pt-6">
        {message && (
          <p
            role={message.kind === "error" ? "alert" : "status"}
            className={`rounded-lg border px-4 py-2.5 text-[13px] ${
              message.kind === "ok"
                ? "border-accent-success/30 bg-[#effaf3] text-accent-success"
                : "border-accent-danger/30 bg-[#fdf0ee] text-accent-danger"
            }`}
          >
            {message.text}
          </p>
        )}

        {/* 講座の概要 */}
        <div className="flex gap-4 rounded-xl border border-border bg-surface p-4">
          <span className="aspect-video w-32 shrink-0 overflow-hidden rounded-lg bg-[#173F35]">
            {course.thumbnailUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={course.thumbnailUrl} alt="" className="h-full w-full object-cover" />
            )}
          </span>
          <div className="min-w-0">
            <p className="font-display text-[17px] font-bold leading-snug text-text-primary">{course.title}</p>
            <p className="mt-1 text-[12px] text-text-muted">
              {t("soldCount", { n: soldCount })}
              {remaining !== null && <> ・ {t("remaining", { n: remaining })}</>}
            </p>
          </div>
        </div>

        {/* 公開後のルール */}
        <div className="rounded-xl border border-[#C9A227]/40 bg-[#C9A227]/10 p-4 text-[13px] leading-relaxed text-[#6B5510]">
          <p className="font-semibold">{t("lockedTitle")}</p>
          <p className="mt-1">{t("lockedBody")}</p>
        </div>

        {/* クイック編集 */}
        <section className="rounded-xl border border-border bg-surface p-5">
          <h2 className="font-display text-[16px] font-bold text-text-primary">{t("quickEditTitle")}</h2>
          <p className="mt-1 text-[12px] text-text-muted">{t("quickEditSub")}</p>

          <div className="mt-4 space-y-4">
            <label className="block text-[13px] text-text-secondary">
              {tEditor("price")}
              {isFree ? (
                <span className="mt-1 block text-[12px] text-text-dim">{t("freeStaysFree")}</span>
              ) : (
                <span className="relative mt-1 block w-40">
                  <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted">¥</span>
                  <input
                    type="number"
                    min={100}
                    max={100000}
                    step={100}
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full rounded-lg border border-border bg-bg py-1.5 pl-6 pr-2 text-[14px] text-text-primary outline-none focus:border-border-strong"
                  />
                </span>
              )}
            </label>

            <label className="block text-[13px] text-text-secondary">
              {tEditor("category")}
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1 block rounded-lg border border-border bg-bg px-2 py-1.5 text-[13px] text-text-primary outline-none focus:border-border-strong"
              >
                <option value="">{tEditor("categoryNone")}</option>
                {COURSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {tHome(`categories.${c}.name`)}
                  </option>
                ))}
              </select>
            </label>

            {!isFree && (
              <label className="block text-[13px] text-text-secondary">
                {t("salesLimit")}
                <input
                  type="number"
                  min={Math.max(1, soldCount)}
                  max={100000}
                  value={salesLimit}
                  placeholder={t("salesLimitPlaceholder")}
                  onChange={(e) => setSalesLimit(e.target.value)}
                  className="mt-1 block w-40 rounded-lg border border-border bg-bg px-2.5 py-1.5 text-[14px] text-text-primary outline-none focus:border-border-strong"
                />
                <span className="mt-1 block text-[11px] text-text-dim">{t("salesLimitHint")}</span>
              </label>
            )}
          </div>

          <button
            type="button"
            onClick={saveQuickEdit}
            disabled={isPending}
            className="mt-5 rounded-lg bg-[#173F35] px-5 py-2 text-[13px] font-semibold text-[#F7F3E8] transition hover:brightness-110 disabled:opacity-60"
          >
            {isPending ? t("saving") : t("save")}
          </button>
        </section>

        {/* 公開・非公開 */}
        <section className="rounded-xl border border-border bg-surface p-5">
          <h2 className="font-display text-[16px] font-bold text-text-primary">{t("visibilityTitle")}</h2>
          <p className="mt-1 text-[12px] leading-relaxed text-text-muted">{t("visibilityBody")}</p>
          <button
            type="button"
            onClick={toggleVisibility}
            disabled={isPending}
            className="mt-4 rounded-lg border border-border px-4 py-2 text-[13px] text-text-primary transition hover:bg-surface-raised disabled:opacity-60"
          >
            {visible ? t("hide") : t("show")}
          </button>
        </section>

        {/* 改訂版 */}
        <section className="rounded-xl border border-border bg-surface p-5">
          <h2 className="font-display text-[16px] font-bold text-text-primary">{t("revisionTitle")}</h2>
          <p className="mt-1 text-[12px] leading-relaxed text-text-muted">{t("revisionBody")}</p>
          <button
            type="button"
            onClick={makeRevision}
            disabled={isPending}
            className="mt-4 rounded-lg bg-[#C9A227] px-4 py-2 text-[13px] font-semibold text-white transition hover:brightness-105 disabled:opacity-60"
          >
            {t("makeRevision")}
          </button>
        </section>
      </div>
    </div>
  );
}
