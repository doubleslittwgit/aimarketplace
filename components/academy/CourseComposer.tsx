"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import CourseEditor from "@/components/academy/CourseEditor";
import { saveCourse } from "@/app/academy/actions";
import { uploadToStorage, sanitizeFileName } from "@/lib/direct-upload";
import {
  compressImage,
  COMPRESS_PRESET_THUMBNAIL,
  COMPRESS_PRESET_GALLERY,
} from "@/lib/compress-image";
import { EMPTY_DOC, type JSONNode } from "@/lib/course-content";
import { COURSE_CATEGORIES } from "@/lib/academy/categories";

const TOPBAR_HEIGHT = 56;

type ToolOption = { id: string; name: string; thumbnail_url: string | null };

export default function CourseComposer({
  courseId,
  userId,
  initial,
  myTools,
  canReceivePayments,
}: {
  /** 既存の講座を編集する場合のID（新規作成時は無し） */
  courseId?: string;
  userId: string;
  initial: {
    title: string;
    thumbnailUrl: string | null;
    price: number;
    category: string | null;
    refundPolicy: "none" | "conditional" | "full";
    content: JSONNode | null;
    status: string;
    toolIds: string[];
  };
  myTools: ToolOption[];
  /** 売上の受け取り設定・本人確認が済んでいるか（有料で出すのに必要） */
  canReceivePayments: boolean;
}) {
  const t = useTranslations("academyEditor");
  const tHome = useTranslations("academyHome");
  const tCourse = useTranslations("academyCourse");
  const router = useRouter();

  // 画像の保存先パスに講座IDを使うため、新規作成でも最初にIDを決めておく
  const [id] = useState(() => courseId ?? crypto.randomUUID());
  const [title, setTitle] = useState(initial.title);
  const [thumbnailUrl, setThumbnailUrl] = useState(initial.thumbnailUrl);
  const [price, setPrice] = useState(String(initial.price));
  const [category, setCategory] = useState(initial.category ?? "");
  const [refundPolicy, setRefundPolicy] = useState(initial.refundPolicy);
  const [toolIds, setToolIds] = useState<string[]>(initial.toolIds);
  const [status, setStatus] = useState(initial.status);
  const docRef = useRef<JSONNode>(initial.content ?? EMPTY_DOC);
  const [dirty, setDirty] = useState(false);
  const [thumbUploading, setThumbUploading] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [isSaving, startSaving] = useTransition();
  const thumbRef = useRef<HTMLInputElement>(null);

  const priceNumber = Math.max(0, Math.round(Number(price) || 0));
  const isPaid = priceNumber > 0;

  async function upload(file: File, kind: "thumb" | "img"): Promise<string | null> {
    const compressed = await compressImage(
      file,
      kind === "thumb" ? COMPRESS_PRESET_THUMBNAIL : COMPRESS_PRESET_GALLERY
    );
    const result = await uploadToStorage({
      bucket: "tool-images",
      key: `${userId}/courses/${id}/${kind}-${crypto.randomUUID().slice(0, 8)}-${sanitizeFileName(compressed.name)}`,
      file: compressed,
    });
    if (!result.ok) {
      setMessage({ kind: "error", text: result.error });
      return null;
    }
    return result.publicUrl ?? null;
  }

  async function onPickThumb(file: File | undefined) {
    if (!file) return;
    setThumbUploading(true);
    const url = await upload(file, "thumb");
    setThumbUploading(false);
    if (thumbRef.current) thumbRef.current.value = "";
    if (url) {
      setThumbnailUrl(url);
      setDirty(true);
    }
  }

  function hasPaywall(): boolean {
    return (docRef.current.content ?? []).some((b) => b.type === "paywall");
  }

  function save(submit: boolean) {
    setMessage(null);
    // 有料なのに有料ラインが無い場合、全文が有料（目次だけ公開）になることを確認する
    if (submit && isPaid && !hasPaywall() && !window.confirm(t("confirmNoPaywall"))) return;

    startSaving(async () => {
      const result = await saveCourse({
        id,
        title,
        thumbnailUrl,
        price: priceNumber,
        category: category || null,
        refundPolicy,
        content: docRef.current,
        submit,
        toolIds,
      });
      if (result.error) {
        setMessage({ kind: "error", text: result.error });
        return;
      }
      setDirty(false);
      if (submit) setStatus("pending_review");
      setMessage({ kind: "ok", text: submit ? t("submitted") : t("saved") });
      // 新規作成だった場合は、再読み込みしても続きから編集できるURLへ切り替える
      if (!courseId) router.replace(`/academy/${id}/edit`);
    });
  }

  const statusLabel =
    status === "pending_review"
      ? t("statusPending")
      : status === "rejected"
        ? t("statusRejected")
        : status === "published"
          ? t("statusPublished")
          : t("statusDraft");

  return (
    <div className="min-h-screen bg-bg">
      {/* ------- 上部バー（Canvaのような編集専用のバー） ------- */}
      <div
        className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-bg/95 px-4 backdrop-blur"
        style={{ height: TOPBAR_HEIGHT }}
      >
        <Link href="/dashboard" className="text-[13px] text-text-muted hover:text-text-primary">
          ← {t("back")}
        </Link>
        <span className="rounded-full bg-surface-raised px-2 py-0.5 text-[11px] text-text-muted">
          {statusLabel}
        </span>
        <span className="hidden text-[12px] text-text-dim sm:inline">
          {isSaving ? t("saving") : dirty ? t("unsaved") : ""}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            disabled={isSaving}
            onClick={() => save(false)}
            className="rounded-lg border border-border px-3 py-1.5 text-[13px] text-text-secondary transition hover:bg-surface disabled:opacity-60"
          >
            {t("saveDraft")}
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={() => save(true)}
            className="rounded-lg bg-accent-signal px-3 py-1.5 text-[13px] font-medium text-white transition hover:brightness-105 disabled:opacity-60"
          >
            {t("submit")}
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 pb-24 pt-6">
        {message && (
          <p
            className={`mb-4 rounded-lg px-3 py-2 text-[13px] ${
              message.kind === "ok"
                ? "bg-accent-success/10 text-accent-success"
                : "bg-accent-danger/10 text-accent-danger"
            }`}
          >
            {message.text}
          </p>
        )}

        {/* ------- ① サムネイル ------- */}
        <button
          type="button"
          onClick={() => thumbRef.current?.click()}
          className="group relative block aspect-video w-full overflow-hidden rounded-xl border border-dashed border-border-strong bg-surface transition hover:bg-surface-raised"
        >
          {thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumbnailUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full flex-col items-center justify-center gap-1 text-text-muted">
              <span className="text-[14px] font-medium">
                {thumbUploading ? t("uploading") : t("uploadThumbnail")}
              </span>
              <span className="text-[12px] text-text-dim">{t("thumbnailHint")}</span>
            </span>
          )}
          {thumbnailUrl && (
            <span className="absolute bottom-3 right-3 rounded-md bg-bg/85 px-2.5 py-1 text-[12px] text-text-secondary opacity-0 shadow-sm transition group-hover:opacity-100">
              {thumbUploading ? t("uploading") : t("changeThumbnail")}
            </span>
          )}
        </button>
        <input
          ref={thumbRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => onPickThumb(e.target.files?.[0])}
        />

        {/* ------- ② タイトル ------- */}
        <textarea
          value={title}
          onChange={(e) => {
            setTitle(e.target.value.replace(/\n/g, ""));
            setDirty(true);
          }}
          rows={1}
          maxLength={120}
          placeholder={t("titlePlaceholder")}
          className="mt-6 w-full resize-none overflow-hidden bg-transparent font-display text-[28px] font-bold leading-snug text-text-primary outline-none placeholder:text-text-dim/60 sm:text-[34px]"
          onInput={(e) => {
            const el = e.currentTarget;
            el.style.height = "auto";
            el.style.height = `${el.scrollHeight}px`;
          }}
        />

        {/* ------- 価格とツールの紐付け ------- */}
        <div className="mt-3 flex flex-wrap items-start gap-x-6 gap-y-3 border-y border-border py-3">
          <label className="flex items-center gap-2 text-[13px] text-text-secondary">
            {t("price")}
            <span className="relative">
              <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted">¥</span>
              <input
                type="number"
                min={0}
                max={100000}
                step={100}
                value={price}
                onChange={(e) => {
                  setPrice(e.target.value);
                  setDirty(true);
                }}
                className="w-32 rounded-lg border border-border bg-surface py-1.5 pl-6 pr-2 text-[14px] text-text-primary outline-none focus:border-border-strong"
              />
            </span>
            {!isPaid && <span className="text-[12px] text-text-dim">{t("free")}</span>}
          </label>

          <label className="flex items-center gap-2 text-[13px] text-text-secondary">
            {t("category")}
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setDirty(true);
              }}
              className="rounded-lg border border-border bg-surface px-2 py-1.5 text-[13px] text-text-primary outline-none focus:border-border-strong"
            >
              <option value="">{t("categoryNone")}</option>
              {COURSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {tHome(`categories.${c}.name`)}
                </option>
              ))}
            </select>
          </label>

          {/* 返金ポリシーは有料講座のときだけ意味を持つ。講座ページの購入欄に表示される */}
          {isPaid && (
            <label className="flex items-center gap-2 text-[13px] text-text-secondary">
              {t("refundPolicy")}
              <select
                value={refundPolicy}
                onChange={(e) => {
                  setRefundPolicy(e.target.value as "none" | "conditional" | "full");
                  setDirty(true);
                }}
                className="rounded-lg border border-border bg-surface px-2 py-1.5 text-[13px] text-text-primary outline-none focus:border-border-strong"
              >
                <option value="none">{tCourse("refund.none")}</option>
                <option value="conditional">{tCourse("refund.conditional")}</option>
                <option value="full">{tCourse("refund.full")}</option>
              </select>
            </label>
          )}

          {myTools.length > 0 && (
            <div className="min-w-0 flex-1">
              <p className="mb-1.5 text-[13px] text-text-secondary">{t("linkTools")}</p>
              <div className="flex flex-wrap gap-1.5">
                {myTools.map((tool) => {
                  const on = toolIds.includes(tool.id);
                  return (
                    <button
                      key={tool.id}
                      type="button"
                      onClick={() => {
                        setToolIds((prev) => (on ? prev.filter((x) => x !== tool.id) : [...prev, tool.id]));
                        setDirty(true);
                      }}
                      className={`rounded-full border px-3 py-1 text-[12px] transition ${
                        on
                          ? "border-accent-signal/40 bg-accent-signal/10 text-accent-signal"
                          : "border-border text-text-secondary hover:border-border-strong"
                      }`}
                    >
                      {tool.name}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1 text-[11px] text-text-dim">{t("linkToolsHint")}</p>
            </div>
          )}
        </div>
        {/* 講座を書くこと自体はログインしていれば誰でもできるが、有料で売るには
            本人確認と受け取り設定が必要。価格を入れた時点で、先に案内する
            （審査に出す段階で初めて断られると、書いた手間が無駄に感じるため）。 */}
        {isPaid && !canReceivePayments && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-accent-signal/40 bg-accent-signal/5 px-4 py-3">
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-text-primary">{t("payoutNoticeTitle")}</p>
              <p className="mt-0.5 text-[12px] text-text-muted">{t("payoutNoticeBody")}</p>
            </div>
            <Link
              href="/seller"
              className="shrink-0 rounded-lg bg-accent-signal px-3.5 py-2 text-[12px] font-medium text-white transition hover:brightness-105"
            >
              {t("payoutNoticeCta")}
            </Link>
          </div>
        )}
        {isPaid && <p className="mt-2 text-[12px] text-text-dim">{t("paywallHint")}</p>}

        {/* ------- ③ 本文 ------- */}
        <div className="mt-5">
          <CourseEditor
            initialContent={initial.content ?? EMPTY_DOC}
            onChange={(doc) => {
              docRef.current = doc;
              setDirty(true);
            }}
            uploadImage={(file) => upload(file, "img")}
            isPaid={isPaid}
            toolbarTop={TOPBAR_HEIGHT}
          />
        </div>
      </div>
    </div>
  );
}
