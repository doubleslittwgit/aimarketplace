"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import CourseEditor from "@/components/academy/CourseEditor";
import AcademyCelebration from "@/components/academy/AcademyCelebration";
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
  celebrateOnMount = false,
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
    /** 最後に保存された日時（新規作成時は無し） */
    savedAt?: string | null;
    status: string;
    toolIds: string[];
  };
  myTools: ToolOption[];
  /** 売上の受け取り設定・本人確認が済んでいるか（有料で出すのに必要） */
  canReceivePayments: boolean;
  /** 新規の講座を提出した直後（編集用のURLに切り替わった後）に、お祝いの演出を出す */
  celebrateOnMount?: boolean;
}) {
  const t = useTranslations("academyEditor");
  const locale = useLocale();
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
  // 最後に保存できた日時。保存ボタンの横に「✅ 保存 9/24 5:41」と出し、
  // 押した結果が分からない状態をなくす
  const [celebrate, setCelebrate] = useState(celebrateOnMount);
  const [savedAt, setSavedAt] = useState<Date | null>(initial.savedAt ? new Date(initial.savedAt) : null);
  const [thumbUploading, setThumbUploading] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [isSaving, startSaving] = useTransition();
  const thumbRef = useRef<HTMLInputElement>(null);

  const formatSavedAt = (d: Date) =>
    new Intl.DateTimeFormat(locale, { month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" }).format(d);

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
      let result: Awaited<ReturnType<typeof saveCourse>>;
      try {
        result = await saveCourse({
        id,
        title,
        thumbnailUrl,
        price: priceNumber,
        category: category || null,
        refundPolicy,
        // 本文は文字列にしてから送る。エディタ（ProseMirror）の本文データには、
        // 通常とは作りの違うオブジェクト（プロトタイプを持たない attrs）が含まれていて、
        // そのまま送るとサーバー側で「読めない預かり物」として扱われ、
        // 「Cannot access textAlign on the server」というエラーで保存できなかった。
        content: JSON.stringify(docRef.current),
        submit,
        toolIds,
      });
      } catch (e) {
        // 通信の失敗やサーバー側の想定外のエラーでも、書いた内容を失わないよう画面は維持する
        setMessage({
          kind: "error",
          text: t("errors.unexpected", { message: e instanceof Error ? e.message : String(e) }),
        });
        return;
      }
      if (result.error) {
        setMessage({ kind: "error", text: result.error });
        return;
      }
      setDirty(false);
      setSavedAt(new Date());
      if (submit) setStatus("pending_review");
      const repeat = "alreadyPending" in result && Boolean(result.alreadyPending);
      // 初めての提出は、中央のお祝い演出で知らせる（再提出は帯で「すでに審査中」と伝える）
      setMessage(submit && repeat ? { kind: "ok", text: t("alreadyInReview") } : null);
      if (submit && !repeat && courseId) setCelebrate(true);
      // 新規作成だった場合は、再読み込みしても続きから編集できるURLへ切り替える。
      // 画面が切り替わるので、演出は切り替わった先で出す（?submitted=1 で合図する）
      if (!courseId) router.replace(`/academy/${id}/edit${submit && !repeat ? "?submitted=1" : ""}`);
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
      {celebrate && (
        <AcademyCelebration
          title={t("celebrate.title")}
          body={t("celebrate.body")}
          primary={{ label: t("celebrate.toDashboard"), href: "/dashboard" }}
          secondary={{ label: t("celebrate.close") }}
          onClose={() => {
            setCelebrate(false);
            // 合図のパラメータを消す（残すと再読み込みのたびに演出が出る）
            if (celebrateOnMount) router.replace(`/academy/${id}/edit`);
          }}
        />
      )}
      {/* ------- 上部バー（Canvaのような編集専用のバー） -------
          保存の結果（日時・エラー）は必ずここに出す。以前は結果をページの一番上に
          出していたため、本文を書いてスクロールした状態では見えず、保存できたのか
          失敗したのか分からなかった（実際に失敗に気づけなかった） */}
      <div className="sticky top-0 z-40 border-b border-border bg-bg/95 backdrop-blur">
        <div className="flex items-center gap-2 px-3 sm:gap-3 sm:px-4" style={{ height: TOPBAR_HEIGHT }}>
          <Link
            href="/dashboard"
            aria-label={t("back")}
            className="shrink-0 text-[13px] text-text-muted hover:text-text-primary"
          >
            ←<span className="hidden sm:inline"> {t("back")}</span>
          </Link>
          <span className="hidden shrink-0 rounded-full bg-surface-raised px-2 py-0.5 text-[11px] text-text-muted sm:inline">
            {statusLabel}
          </span>
          <span
            className={`min-w-0 flex-1 truncate text-right text-[11px] sm:text-[12px] ${
              message?.kind === "error"
                ? "font-medium text-accent-danger"
                : savedAt && !dirty
                  ? "text-accent-success"
                  : "text-text-dim"
            }`}
          >
            {isSaving
              ? t("saving")
              : message?.kind === "error"
                ? t("saveFailedShort")
                : savedAt && !dirty
                  ? `✅ ${t("savedAt", { time: formatSavedAt(savedAt) })}`
                  : dirty
                    ? t("unsaved")
                    : ""}
          </span>
          <button
            type="button"
            disabled={isSaving}
            onClick={() => save(false)}
            className="shrink-0 rounded-lg border border-border px-2.5 py-1.5 text-[12px] text-text-secondary transition hover:bg-surface disabled:opacity-60 sm:px-3 sm:text-[13px]"
          >
            {t("saveDraft")}
          </button>
          {/* 審査中は「審査に出す」を押せなくする（サーバー側でも二重提出は止めている） */}
          <button
            type="button"
            disabled={isSaving || status === "pending_review"}
            onClick={() => save(true)}
            className="shrink-0 rounded-lg bg-accent-signal px-2.5 py-1.5 text-[12px] font-medium text-white transition hover:brightness-105 disabled:opacity-60 sm:px-3 sm:text-[13px]"
          >
            {status === "pending_review" ? t("statusPending") : t("submit")}
          </button>
        </div>

        {/* 結果の詳細は、上部バーのすぐ下に重ねて出す（スクロール位置に関係なく見える） */}
        {message && (
          <div
            className={`absolute inset-x-0 top-full flex items-start gap-2 border-b px-4 py-2.5 text-[13px] shadow-sm ${
              message.kind === "ok"
                ? "border-accent-success/30 bg-[#effaf3] text-accent-success"
                : "border-accent-danger/30 bg-[#fdf0ee] text-accent-danger"
            }`}
            role={message.kind === "error" ? "alert" : "status"}
          >
            <p className="min-w-0 flex-1 leading-relaxed">{message.text}</p>
            <button
              type="button"
              onClick={() => setMessage(null)}
              aria-label={t("cancel")}
              className="shrink-0 px-1 text-[16px] leading-none opacity-70 hover:opacity-100"
            >
              ×
            </button>
          </div>
        )}
      </div>

      <div className="mx-auto max-w-3xl px-4 pb-24 pt-6">
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
