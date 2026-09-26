"use client";

import { useState, useTransition, useRef, useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
import InternetAccessPicker from "@/components/InternetAccessPicker";
import ToolLanguagePicker from "@/components/ToolLanguagePicker";
import type { ToolLanguage } from "@/lib/tool-languages";
import type { InternetAccess } from "@/lib/internet-access";
import { categories, MAX_TOOL_FILE_SIZE, MAX_THUMBNAIL_FILE_SIZE, formatFileSize } from "@/lib/mock-data";
import { categoryToSlug } from "@/lib/category-slugs";
import { CREATIVE_APPS } from "@/lib/creative-apps";
import { TOOL_FILE_ACCEPT, isAllowedToolFile } from "@/lib/tool-file-types";
import { parseVideoUrl } from "@/lib/video-embed";
import { compressImage, compressImagesSequentially, COMPRESS_PRESET_THUMBNAIL, COMPRESS_PRESET_GALLERY } from "@/lib/compress-image";
import { uploadToStorage, sanitizeFileName } from "@/lib/direct-upload";
import { createClient as createBrowserSupabase } from "@/lib/supabase/client";
import { createTool, saveDraft } from "./actions";

type PriceType = "free" | "paid" | null;

export type DraftInitialValues = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  category: string;
  categories: string[];
  price: number;
  runtime: "cloud" | "local";
  internetAccess: InternetAccess | null;
  uiLanguages: ToolLanguage[];
  platforms: string[];
  minOsVersion: string | null;
  demoUrl: string | null;
  thumbnailUrl: string | null;
  galleryUrls: string[];
  fileName: string | null;
};

export default function SubmitClient({
  canReceivePayments,
  initialDraft,
}: {
  canReceivePayments: boolean;
  initialDraft?: DraftInitialValues | null;
}) {
  const t = useTranslations("submit");
  const tCategories = useTranslations("categories");
  const [draftId, setDraftId] = useState<string | null>(initialDraft?.id ?? null);
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(null);
  const [priceType, setPriceType] = useState<PriceType>(
    initialDraft ? (initialDraft.price > 0 ? "paid" : "free") : null
  );
  const [price, setPrice] = useState(
    initialDraft ? String(initialDraft.price || "") : ""
  );
  const [runtime, setRuntime] = useState<"cloud" | "local">(
    initialDraft?.runtime ?? "cloud"
  );
  const [internetAccess, setInternetAccess] = useState<InternetAccess | null>(
    initialDraft?.internetAccess ?? null
  );
  const [uiLanguages, setUiLanguages] = useState<ToolLanguage[]>(initialDraft?.uiLanguages ?? []);
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(
    initialDraft?.fileName ?? null
  );
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [platforms, setPlatforms] = useState<string[]>(initialDraft?.platforms ?? []);
  const [minOsVersion, setMinOsVersion] = useState(initialDraft?.minOsVersion ?? "");
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(
    initialDraft?.thumbnailUrl ?? null
  );
  const [thumbnailName, setThumbnailName] = useState<string | null>(null);
  const [thumbnailSize, setThumbnailSize] = useState<number | null>(null);
  const [existingGallery, setExistingGallery] = useState<string[]>(
    initialDraft?.galleryUrls ?? []
  );
  const [newGalleryFiles, setNewGalleryFiles] = useState<File[]>([]);
  const [galleryError, setGalleryError] = useState<string | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    initialDraft?.categories?.length
      ? initialDraft.categories
      : initialDraft?.category
        ? [initialDraft.category]
        : []
  );

  function toggleCategory(c: string) {
    setSelectedCategories((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    );
  }
  const [selectedHostApps, setSelectedHostApps] = useState<string[]>([]);
  // 入力中の動画URL（YouTube/Vimeo以外なら、その場で注意を出すため）
  const [videoUrl, setVideoUrl] = useState("");
  function toggleHostApp(slug: string) {
    setSelectedHostApps((prev) =>
      prev.includes(slug) ? prev.filter((x) => x !== slug) : [...prev, slug]
    );
  }
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  // アップロードの進捗表示用。大きなファイルは時間がかかるため、
  // 「今どの段階で、何%進んでいるか」が見えないと不安になる。
  const [uploadLabel, setUploadLabel] = useState<string | null>(null);
  const [uploadPercent, setUploadPercent] = useState(0);
  const supabaseBrowser = useMemo(() => createBrowserSupabase(), []);
  const [isSavingDraft, startSaveDraft] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const MAX_GALLERY_IMAGES = 5;
  const formRef = useRef<HTMLFormElement>(null);

  function togglePlatform(p: string) {
    setPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  }

  const priceNumber = Number(price);
  const fileTooLarge = fileSize !== null && fileSize > MAX_TOOL_FILE_SIZE;
  const thumbnailTooLarge = thumbnailSize !== null && thumbnailSize > MAX_THUMBNAIL_FILE_SIZE;

  // 有料を選んだのに受け取り設定が終わっていない場合は、
  // 詳細フォームそのものを表示しない（どうせ公開できないため）。
  const paidBlocked = priceType === "paid" && !canReceivePayments;
  const showForm =
    priceType === "free" || (priceType === "paid" && canReceivePayments);
  const priceValid =
    priceType === "free" || (priceType === "paid" && priceNumber > 0);

  function handleFile(file: File | undefined) {
    if (!file) return;
    // ドラッグ&ドロップや、選択画面で「すべてのファイル」に切り替えた場合は
    // acceptを素通りしてしまうので、ここでも形式を確認する
    if (!isAllowedToolFile(file.name)) {
      setError(t("errorUnsupportedFileType"));
      return;
    }
    setError(null);
    setFileName(file.name);
    setFileSize(file.size);

    // ドラッグ&ドロップで受け取ったファイルを、実際のinput要素にも反映する。
    // これをしないと見た目上はファイル名が表示されても、
    // フォーム送信時にファイルの中身が送られない。
    if (fileInputRef.current) {
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      fileInputRef.current.files = dataTransfer.files;
    }
  }

  async function handleThumbnail(file: File | undefined) {
    if (!file) return;
    const compressed = await compressImage(file, COMPRESS_PRESET_THUMBNAIL);
    // 圧縮後のファイルをinput要素の中身にも反映する
    // （そうしないと、フォーム送信時に圧縮前の元ファイルが送られてしまう）
    if (thumbnailInputRef.current) {
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(compressed);
      thumbnailInputRef.current.files = dataTransfer.files;
    }
    setThumbnailName(compressed.name);
    setThumbnailSize(compressed.size);
    setThumbnailPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(compressed);
    });
  }

  /** newGalleryFilesの内容を、隠しinput(name="galleryImages")のfilesに反映する */
  function syncGalleryInput(files: File[]) {
    if (!galleryInputRef.current) return;
    const dataTransfer = new DataTransfer();
    files.forEach((f) => dataTransfer.items.add(f));
    galleryInputRef.current.files = dataTransfer.files;
  }

  async function handleGalleryAdd(selected: FileList | null) {
    if (!selected) return;
    setGalleryError(null);
    const remaining = MAX_GALLERY_IMAGES - existingGallery.length - newGalleryFiles.length;
    const incoming = Array.from(selected);

    if (incoming.length > remaining) {
      setGalleryError(t("galleryLimitError", { remaining }));
    }

    const oversized = incoming.find((f) => f.size > MAX_THUMBNAIL_FILE_SIZE);
    if (oversized) {
      setGalleryError(
        t("galleryFileTooLargeError", {
          name: oversized.name,
          limit: formatFileSize(MAX_THUMBNAIL_FILE_SIZE) ?? "",
        })
      );
    }

    const toAccept = incoming
      .filter((f) => f.size <= MAX_THUMBNAIL_FILE_SIZE)
      .slice(0, Math.max(0, remaining));
    const accepted = await compressImagesSequentially(toAccept, COMPRESS_PRESET_GALLERY);

    const next = [...newGalleryFiles, ...accepted];
    setNewGalleryFiles(next);
    syncGalleryInput(next);
  }

  function removeExistingGalleryImage(url: string) {
    setExistingGallery((prev) => prev.filter((u) => u !== url));
    setGalleryError(null);
  }

  function removeNewGalleryImage(index: number) {
    const next = newGalleryFiles.filter((_, i) => i !== index);
    setNewGalleryFiles(next);
    syncGalleryInput(next);
    setGalleryError(null);
  }

  /**
   * 送信前に、ファイル・画像をブラウザから直接Supabaseへアップロードし、
   * FormDataの中身を「ファイル本体」から「アップロード済みのパス」に差し替える。
   *
   * Vercelのサーバー関数には1リクエスト4.5MBという回避不能な上限があるため、
   * ファイル本体をServer Actionに渡すと、大きいファイルで必ず失敗してしまう。
   */
  async function prepareUploads(formData: FormData): Promise<string | null> {
    // ツールIDは、アップロード先のパスに含める必要があるので先に決めておく
    // （サーバー側もこのIDをそのまま使うため、下書きがあればそれを引き継ぐ）
    const toolId = draftId ?? crypto.randomUUID();
    formData.set("draftId", draftId ?? "");
    formData.set("newToolId", toolId);

    const {
      data: { user },
    } = await supabaseBrowser.auth.getUser();
    if (!user) return t("errorSessionExpired");

    // 1. ツール本体（ローカル実行の場合のみ）
    const file = fileInputRef.current?.files?.[0];
    if (runtime === "local" && file) {
      setUploadLabel(t("uploadingFile"));
      setUploadPercent(0);
      const result = await uploadToStorage({
        bucket: "tool-files",
        key: `${user.id}/${toolId}/${sanitizeFileName(file.name)}`,
        file,
        onProgress: ({ percent }) => setUploadPercent(percent),
      });
      if (!result.ok) return result.error;
      formData.set("uploadedFileKey", result.key);
      formData.set("uploadedFileSize", String(file.size));
    }

    // 2. サムネイル
    const thumb = thumbnailInputRef.current?.files?.[0];
    if (thumb) {
      setUploadLabel(t("uploadingThumbnail"));
      setUploadPercent(0);
      const result = await uploadToStorage({
        bucket: "tool-images",
        key: `${user.id}/${toolId}/${sanitizeFileName(thumb.name)}`,
        file: thumb,
        onProgress: ({ percent }) => setUploadPercent(percent),
      });
      if (!result.ok) return result.error;
      formData.set("uploadedThumbnailUrl", result.publicUrl ?? "");
    }

    // 3. ギャラリー画像
    const galleryUrls: string[] = [];
    for (let i = 0; i < newGalleryFiles.length; i++) {
      const image = newGalleryFiles[i];
      setUploadLabel(t("uploadingGallery", { current: i + 1, total: newGalleryFiles.length }));
      setUploadPercent(0);
      const result = await uploadToStorage({
        bucket: "tool-images",
        key: `${user.id}/${toolId}/gallery-${crypto.randomUUID().slice(0, 8)}-${sanitizeFileName(image.name)}`,
        file: image,
        onProgress: ({ percent }) => setUploadPercent(percent),
      });
      if (!result.ok) return result.error;
      if (result.publicUrl) galleryUrls.push(result.publicUrl);
    }
    formData.set("uploadedGalleryUrls", galleryUrls.join(","));

    // ファイル本体はサーバーに送らない（4.5MBの上限に引っかかるため）
    formData.delete("file");
    formData.delete("thumbnail");
    formData.delete("galleryImages");

    setUploadLabel(null);
    return null;
  }

  function handleFormAction(formData: FormData) {
    setError(null);
    if (selectedCategories.length === 0) {
      setError(t("errorCategoryRequired"));
      return;
    }
    if (fileTooLarge) {
      setError(t("errorFileTooLarge", { limit: formatFileSize(MAX_TOOL_FILE_SIZE) ?? "" }));
      return;
    }
    if (thumbnailTooLarge) {
      setError(
        t("errorThumbnailTooLarge", { limit: formatFileSize(MAX_THUMBNAIL_FILE_SIZE) ?? "" })
      );
      return;
    }
    startTransition(async () => {
      const uploadError = await prepareUploads(formData);
      if (uploadError) {
        setUploadLabel(null);
        setError(uploadError);
        return;
      }
      const result = await createTool(formData);
      if (result?.error) setError(result.error);
    });
  }

  function handleSaveDraft() {
    if (!formRef.current) return;
    setError(null);
    const formData = new FormData(formRef.current);
    startSaveDraft(async () => {
      const uploadError = await prepareUploads(formData);
      if (uploadError) {
        setUploadLabel(null);
        setError(uploadError);
        return;
      }
      const result = await saveDraft(formData, draftId ?? undefined);
      if (result.error !== null) {
        setError(result.error);
        return;
      }
      setDraftId(result.draftId);
      setDraftSavedAt(new Date());
    });
  }

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="mb-1 font-display text-2xl font-semibold text-text-primary">
          {initialDraft ? t("titleDraft") : t("titleNew")}
        </h1>
        <p className="mb-8 text-[13px] text-text-muted">
          {initialDraft ? t("subtitleDraft") : t("subtitleNew")}
        </p>

        <form ref={formRef} action={handleFormAction} className="space-y-7">
          {draftId && <input type="hidden" name="draftId" value={draftId} />}
          {error && (
            <div className="rounded-lg border border-accent-danger/30 bg-accent-danger/10 px-3.5 py-2.5 text-[13px] text-accent-danger">
              {error}
            </div>
          )}

          {/* 無料 / 有料 の選択（一番最初に決める） */}
          <div>
            <label className="mb-2 block text-[13px] font-medium text-text-secondary">
              {t("publishMethod")}
              <span className="ml-1 text-accent-signal">*</span>
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <PriceTypeOption
                label={t("free")}
                description={t("freeDescription")}
                active={priceType === "free"}
                onClick={() => {
                  setPriceType("free");
                  setPrice("0");
                }}
              />
              <PriceTypeOption
                label={t("paid")}
                description={t("paidDescription")}
                active={priceType === "paid"}
                onClick={() => {
                  setPriceType("paid");
                  setPrice("");
                }}
              />
            </div>

            {/* 有料だが受け取り設定が未完了 → 案内を出し、フォームは見せない */}
            {paidBlocked && (
              <div className="mt-4 rounded-lg border border-accent-danger/30 bg-accent-danger/5 p-4">
                <p className="mb-2 text-[13px] font-semibold text-accent-danger">
                  {t("payoutRequiredTitle")}
                </p>
                <ol className="mb-3 space-y-1.5">
                  {[t("payoutStep1"), t("payoutStep2"), t("payoutStep3")].map((text, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-[12px] text-accent-danger/90"
                    >
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent-danger/15 text-[10px] font-semibold">
                        {i + 1}
                      </span>
                      {text}
                    </li>
                  ))}
                </ol>
                <a
                  href="/seller"
                  className="inline-block rounded-lg bg-accent-danger px-4 py-2 text-[12px] font-medium text-white transition hover:brightness-105"
                >
                  {t("payoutCta")}
                </a>
              </div>
            )}

            {/* 有料 & 受け取り設定済み → 価格入力欄を出す */}
            {priceType === "paid" && canReceivePayments && (
              <div className="mt-4">
                <label className="mb-1.5 block text-[12px] text-text-muted">
                  {t("price")}
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xl text-text-muted">
                    ¥
                  </span>
                  <input
                    type="number"
                    name="price"
                    required
                    min={1}
                    step={100}
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="0"
                    className="w-full rounded-lg border border-border bg-surface py-3 pl-9 pr-4 text-2xl font-semibold text-text-primary outline-none placeholder:text-text-dim focus:border-border-strong"
                  />
                </div>
                <p className="mt-2 text-[12px] text-text-dim">
                  {priceNumber > 0
                    ? t("priceHint", {
                        amount: priceNumber.toLocaleString(),
                        net: Math.round(priceNumber * 0.8).toLocaleString(),
                      })
                    : t("priceHintEmpty")}
                </p>
              </div>
            )}

            {priceType === "free" && (
              <input type="hidden" name="price" value="0" />
            )}
          </div>

          {/* 実行環境（無料/有料の次に決める、重要な設定のため） */}
          {(priceType === "free" || (priceType === "paid" && canReceivePayments)) && (
            <Field label={t("runtime")} required>
              <div className="flex gap-3">
                <RuntimeOption
                  label={t("runtimeCloud")}
                  description={t("runtimeCloudDescription")}
                  active={runtime === "cloud"}
                  onClick={() => setRuntime("cloud")}
                />
                <RuntimeOption
                  label={t("runtimeLocal")}
                  description={t("runtimeLocalDescription")}
                  active={runtime === "local"}
                  onClick={() => setRuntime("local")}
                />
              </div>

              {priceType === "paid" && runtime === "cloud" && (
                <p className="mt-3 text-[12px] font-medium leading-relaxed text-accent-danger">
                  {t("cloudPaidWarning")}
                </p>
              )}
            </Field>
          )}

          {/* インターネット接続の要否（ローカル実行・クラウドのどちらでも選ぶ） */}
          {(priceType === "free" || (priceType === "paid" && canReceivePayments)) && (
            <Field label={t("internetAccess.title")} required>
              <InternetAccessPicker value={internetAccess} onChange={setInternetAccess} />
            </Field>
          )}

          {/* ツールの対応言語（複数選択） */}
          {(priceType === "free" || (priceType === "paid" && canReceivePayments)) && (
            <Field label={t("languages.title")} required>
              <ToolLanguagePicker value={uiLanguages} onChange={setUiLanguages} />
            </Field>
          )}

          {showForm && (
            <>
              {/* サムネイル画像 */}
              <Field label={t("thumbnail")}>
                <div className="flex items-center gap-4">
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface">
                    {thumbnailPreview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={thumbnailPreview}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <svg
                        width="22"
                        height="22"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        className="text-text-dim"
                      >
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <circle cx="9" cy="9" r="1.5" />
                        <path d="m21 15-5-5L5 21" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={() => thumbnailInputRef.current?.click()}
                      className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3.5 py-2 text-[13px] font-medium text-text-secondary transition hover:border-border-strong hover:bg-surface-raised"
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M12 3v12m0-12 4 4m-4-4-4 4" />
                        <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
                      </svg>
                      {thumbnailName ? t("changeImage") : t("selectImage")}
                    </button>
                    {thumbnailName && (
                      <p className="mt-1.5 text-[12px] text-text-secondary">
                        {thumbnailName}
                        {thumbnailSize !== null && ` ・ ${formatFileSize(thumbnailSize)}`}
                      </p>
                    )}
                    {thumbnailTooLarge && (
                      <p className="mt-1 text-[12px] text-accent-danger">
                        {t("thumbnailOverLimit", { limit: formatFileSize(MAX_THUMBNAIL_FILE_SIZE) ?? "" })}
                      </p>
                    )}
                    <p className="mt-1.5 text-[12px] text-text-dim">
                      {t("thumbnailHint", { limit: formatFileSize(MAX_THUMBNAIL_FILE_SIZE) ?? "" })}
                    </p>
                    <input
                      ref={thumbnailInputRef}
                      type="file"
                      name="thumbnail"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(e) => handleThumbnail(e.target.files?.[0])}
                      className="hidden"
                    />
                  </div>
                </div>
              </Field>

              {/* ギャラリー画像（最大5枚、商品詳細ページで矢印で切り替えられる） */}
              <Field label={t("gallery")}>
                <div className="flex flex-wrap gap-3">
                  {existingGallery.map((url) => (
                    <div key={url} className="group relative h-20 w-20 shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt=""
                        className="h-full w-full rounded-lg border border-border object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeExistingGalleryImage(url)}
                        aria-label={t("removeImage")}
                        className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-text-primary text-white shadow-sm"
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                          <path d="M18 6 6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                  {newGalleryFiles.map((file, i) => (
                    <GalleryFilePreview
                      key={`${file.name}-${i}`}
                      file={file}
                      onRemove={() => removeNewGalleryImage(i)}
                      removeLabel={t("removeImage")}
                    />
                  ))}

                  {existingGallery.length + newGalleryFiles.length < MAX_GALLERY_IMAGES && (
                    <button
                      type="button"
                      onClick={() => {
                        // 隠しinputは複数選択の累積用に上書きしていくので、
                        // クリックのたびに空にしてから開く
                        if (galleryInputRef.current) galleryInputRef.current.value = "";
                        galleryInputRef.current?.click();
                      }}
                      className="flex h-20 w-20 shrink-0 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border text-text-dim transition hover:border-border-strong hover:text-text-muted"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                      <span className="text-[11px]">{t("add")}</span>
                    </button>
                  )}
                </div>

                <input type="hidden" name="existingGalleryUrls" value={existingGallery.join(",")} readOnly />
                <input
                  ref={galleryInputRef}
                  type="file"
                  name="galleryImages"
                  multiple
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => handleGalleryAdd(e.target.files)}
                  className="hidden"
                />

                {galleryError && (
                  <p className="mt-2 text-[12px] text-accent-danger">{galleryError}</p>
                )}
                <p className="mt-2 text-[12px] text-text-dim">
                  {t("galleryHint", { limit: formatFileSize(MAX_THUMBNAIL_FILE_SIZE) ?? "" })}
                </p>
              </Field>

              <Field label={t("videoUrlLabel")}>
                <input
                  type="url"
                  name="videoUrl"
                  defaultValue=""
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder={t("videoUrlPlaceholder")}
                  className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-[14px] text-text-primary outline-none focus:border-border-strong"
                />
                {videoUrl.trim() && !parseVideoUrl(videoUrl) ? (
                  <p className="mt-2 text-[12px] text-accent-danger">{t("videoUrlInvalid")}</p>
                ) : (
                  <p className="mt-2 text-[12px] text-text-dim">{t("videoUrlHint")}</p>
                )}
              </Field>

              {/* 実行環境に応じて、ファイルアップロード or デモURL のどちらかを表示 */}
              <input type="hidden" name="runtime" value={runtime} />
              <input type="hidden" name="platforms" value={platforms.join(",")} readOnly />

              {runtime === "local" ? (
                <Field label={t("file")} required>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOver(false);
                      handleFile(e.dataTransfer.files?.[0]);
                    }}
                    className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition ${
                      dragOver
                        ? "border-accent-ai bg-accent-ai-dim"
                        : "border-border bg-surface hover:border-border-strong"
                    }`}
                  >
                    <svg
                      width="28"
                      height="28"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      className="mb-3 text-text-dim"
                    >
                      <path d="M12 3v12m0-12 4 4m-4-4-4 4" />
                      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
                    </svg>
                    {fileName ? (
                      <>
                        <p className="text-[13px] font-medium text-text-primary">
                          {fileName}
                        </p>
                        {fileSize !== null && (
                          <p
                            className={`mt-1 text-[12px] ${
                              fileTooLarge ? "text-accent-danger" : "text-text-muted"
                            }`}
                          >
                            {formatFileSize(fileSize)}
                            {fileTooLarge &&
                              t("fileOverLimit", { limit: formatFileSize(MAX_TOOL_FILE_SIZE) ?? "" })}
                          </p>
                        )}
                      </>
                    ) : (
                      <>
                        <p className="text-[13px] text-text-secondary">
                          {t("dropHint")}
                        </p>
                        <p className="mt-1 text-[12px] text-text-dim">
                          {t("fileTypeHint", { limit: formatFileSize(MAX_TOOL_FILE_SIZE) ?? "" })}
                        </p>
                      </>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      name="file"
                      accept={TOOL_FILE_ACCEPT}
                      required={!fileName}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => handleFile(e.target.files?.[0])}
                      className="hidden"
                    />
                  </div>
                </Field>
              ) : (
                <Field label={t("demoUrl")} required>
                  <input
                    type="url"
                    name="demoUrl"
                    required
                    defaultValue={initialDraft?.demoUrl ?? ""}
                    placeholder="https://your-tool.vercel.app"
                    className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-[14px] text-text-primary outline-none placeholder:text-text-dim focus:border-border-strong"
                  />
                  <p className="mt-2 text-[12px] text-text-dim">
                    {t("demoUrlHint")}
                  </p>
                </Field>
              )}

              {/* ツール名 */}
              <Field label={t("toolName")} required>
                <input
                  type="text"
                  name="name"
                  required
                  defaultValue={initialDraft?.name}
                  placeholder={t("toolNamePlaceholder")}
                  className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-[14px] text-text-primary outline-none placeholder:text-text-dim focus:border-border-strong"
                />
              </Field>

              {/* キャッチコピー */}
              <Field label={t("tagline")} required>
                <input
                  type="text"
                  name="tagline"
                  required
                  maxLength={60}
                  defaultValue={initialDraft?.tagline}
                  placeholder={t("taglinePlaceholder")}
                  className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-[14px] text-text-primary outline-none placeholder:text-text-dim focus:border-border-strong"
                />
              </Field>

              {/* 詳細説明 */}
              <Field label={t("description")} required>
                <textarea
                  name="description"
                  required
                  rows={5}
                  defaultValue={initialDraft?.description}
                  placeholder={t("descriptionPlaceholder")}
                  className="w-full resize-none rounded-lg border border-border bg-surface px-3.5 py-2.5 text-[14px] text-text-primary outline-none placeholder:text-text-dim focus:border-border-strong"
                />
              </Field>

              {/* カテゴリ（複数選択可） */}
              <Field label={t("categoryLabel")} required>
                <div className="flex flex-wrap gap-2">
                  {categories.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => toggleCategory(c)}
                      className={`rounded-full border px-3.5 py-1.5 text-[13px] transition ${
                        selectedCategories.includes(c)
                          ? "border-accent-signal/40 bg-accent-signal/10 text-accent-signal"
                          : "border-border text-text-secondary hover:border-border-strong"
                      }`}
                    >
                      {tCategories(categoryToSlug(c))}
                    </button>
                  ))}
                </div>
                <input
                  type="hidden"
                  name="categories"
                  value={selectedCategories.join(",")}
                  readOnly
                />
                {selectedCategories.length === 0 && (
                  <p className="mt-2 text-[12px] text-text-dim">
                    {t("categoryRequired")}
                  </p>
                )}
              </Field>

              <Field label={t("hostAppsLabel")}>
                <p className="mb-2 text-[12px] text-text-dim">{t("hostAppsHint")}</p>
                <div className="flex flex-wrap gap-2">
                  {CREATIVE_APPS.map((app) => (
                    <button
                      key={app.slug}
                      type="button"
                      onClick={() => toggleHostApp(app.slug)}
                      className={`rounded-full border px-3.5 py-1.5 text-[13px] transition ${
                        selectedHostApps.includes(app.slug)
                          ? "border-accent-signal/40 bg-accent-signal/10 text-accent-signal"
                          : "border-border text-text-secondary hover:border-border-strong"
                      }`}
                    >
                      {app.name}
                    </button>
                  ))}
                </div>
                <input
                  type="hidden"
                  name="hostApps"
                  value={selectedHostApps.join(",")}
                  readOnly
                />
              </Field>

              <Field label={t("remixLabel")}>
                <label className="flex cursor-pointer items-start gap-2.5">
                  <input
                    type="checkbox"
                    name="remixAllowed"
                    value="1"
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-border"
                  />
                  <span>
                    <span className="block text-[13px] text-text-secondary">
                      {t("remixEnable")}
                    </span>
                    <span className="mt-0.5 block text-[12px] text-text-dim">
                      {t("remixHint")}
                    </span>
                  </span>
                </label>
              </Field>

              <Field label={t("refundPolicyLabel")}>
                <p className="mb-2 text-[12px] text-text-dim">{t("refundPolicyHint")}</p>
                <select
                  name="refundPolicy"
                  defaultValue="none"
                  className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-[14px] text-text-primary outline-none focus:border-border-strong"
                >
                  <option value="none">{t("refundPolicyNone")}</option>
                  <option value="conditional">{t("refundPolicyConditional")}</option>
                  <option value="full">{t("refundPolicyFull")}</option>
                </select>
              </Field>

              <Field label={t("wipLabel")}>
                <label className="flex cursor-pointer items-start gap-2.5">
                  <input
                    type="checkbox"
                    name="isWip"
                    value="1"
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-border"
                  />
                  <span>
                    <span className="block text-[13px] text-text-secondary">{t("wipEnable")}</span>
                    <span className="mt-0.5 block text-[12px] text-text-dim">{t("wipHint")}</span>
                  </span>
                </label>
              </Field>

              {/* 対応環境 */}
              {runtime === "local" ? (
                <Field label={t("supportedOs")} required>
                  <div className="flex flex-wrap gap-2">
                    {["Windows", "macOS", "Linux"].map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => togglePlatform(p)}
                        className={`rounded-full border px-4 py-1.5 text-[13px] transition ${
                          platforms.includes(p)
                            ? "border-accent-ai/40 bg-accent-ai-dim text-accent-ai"
                            : "border-border text-text-secondary hover:border-border-strong"
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    name="minOsVersion"
                    value={minOsVersion}
                    onChange={(e) => setMinOsVersion(e.target.value)}
                    placeholder={t("minOsPlaceholder")}
                    className="mt-3 w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-[14px] text-text-primary outline-none placeholder:text-text-dim focus:border-border-strong"
                  />
                  <p className="mt-2 text-[12px] text-text-dim">
                    {t("minOsHint")}
                  </p>
                </Field>
              ) : (
                <Field label={t("recommendedEnv")}>
                  <input
                    type="text"
                    name="minOsVersion"
                    defaultValue={initialDraft?.minOsVersion || "Chrome / Edge / Safari"}
                    className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-[14px] text-text-primary outline-none placeholder:text-text-dim focus:border-border-strong"
                  />
                  <p className="mt-2 text-[12px] text-text-dim">
                    {t("recommendedEnvHint")}
                  </p>
                </Field>
              )}

              {uploadLabel && (
                <div className="rounded-lg border border-border bg-surface p-3.5">
                  <div className="mb-2 flex items-center justify-between text-[12px]">
                    <span className="text-text-secondary">{uploadLabel}</span>
                    <span className="font-mono text-text-muted">{uploadPercent}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-raised">
                    <div
                      className="h-full rounded-full bg-accent-signal transition-[width] duration-200"
                      style={{ width: `${uploadPercent}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={isPending || fileTooLarge || thumbnailTooLarge || !priceValid}
                  className="flex-1 rounded-lg bg-accent-signal py-3 text-sm font-medium text-white transition hover:brightness-105 disabled:opacity-60"
                >
                  {isPending ? t("publishing") : t("publish")}
                </button>
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  disabled={isSavingDraft}
                  className="rounded-lg border border-border bg-surface px-5 py-3 text-sm font-medium text-text-secondary transition hover:bg-surface-raised disabled:opacity-60"
                >
                  {isSavingDraft ? t("savingDraft") : t("saveDraft")}
                </button>
              </div>
              {draftSavedAt && (
                <p className="text-[12px] text-text-muted">
                  {t("draftSaved", { time: draftSavedAt.toLocaleTimeString() })}
                </p>
              )}
            </>
          )}
        </form>
      </div>
    </main>
  );
}

function GalleryFilePreview({
  file,
  onRemove,
  removeLabel,
}: {
  file: File;
  onRemove: () => void;
  removeLabel: string;
}) {
  const preview = useMemo(() => URL.createObjectURL(file), [file]);

  useEffect(() => {
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  return (
    <div className="group relative h-20 w-20 shrink-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={preview} alt="" className="h-full w-full rounded-lg border border-border object-cover" />
      <button
        type="button"
        onClick={onRemove}
        aria-label={removeLabel}
        className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-text-primary text-white shadow-sm"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-[13px] font-medium text-text-secondary">
        {label}
        {required && <span className="ml-1 text-accent-signal">*</span>}
      </label>
      {children}
    </div>
  );
}

function RuntimeOption({
  label,
  description,
  active,
  onClick,
}: {
  label: string;
  description: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-lg border px-4 py-3 text-left transition ${
        active
          ? "border-accent-ai bg-accent-ai-dim"
          : "border-border bg-surface hover:border-border-strong"
      }`}
    >
      <p
        className={`text-[13px] font-medium ${
          active ? "text-accent-ai" : "text-text-primary"
        }`}
      >
        {label}
      </p>
      <p className="mt-0.5 text-[12px] text-text-muted">{description}</p>
    </button>
  );
}

function PriceTypeOption({
  label,
  description,
  active,
  onClick,
}: {
  label: string;
  description: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border-2 px-5 py-5 text-center transition ${
        active
          ? "border-accent-signal bg-accent-signal/5"
          : "border-border bg-surface hover:border-border-strong"
      }`}
    >
      <p
        className={`font-display text-xl font-semibold ${
          active ? "text-accent-signal" : "text-text-primary"
        }`}
      >
        {label}
      </p>
      <p className="mt-1 text-[12px] text-text-muted">{description}</p>
    </button>
  );
}
