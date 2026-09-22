"use client";

import { useState, useTransition, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { categories, MAX_TOOL_FILE_SIZE, MAX_THUMBNAIL_FILE_SIZE, formatFileSize } from "@/lib/mock-data";
import { categoryToSlug } from "@/lib/category-slugs";
import { CREATIVE_APPS } from "@/lib/creative-apps";
import { TOOL_FILE_ACCEPT, isAllowedToolFile } from "@/lib/tool-file-types";
import { compressImage, compressImagesSequentially, COMPRESS_PRESET_THUMBNAIL, COMPRESS_PRESET_GALLERY } from "@/lib/compress-image";
import { uploadToStorage, sanitizeFileName } from "@/lib/direct-upload";
import { createClient as createBrowserSupabase } from "@/lib/supabase/client";
import { updateTool, setToolPublished, deleteTool } from "./actions";

type Tool = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  category: string;
  categories: string[] | null;
  host_apps: string[] | null;
  price: number;
  sale_price: number | null;
  sale_ends_at: string | null;
  runtime: "cloud" | "local";
  platforms: string[] | null;
  min_os_version: string | null;
  demo_url: string | null;
  thumbnail_url: string | null;
  gallery_urls: string[] | null;
  file_key: string | null;
  status: "draft" | "pending_review" | "published" | "suspended";
};

export default function EditToolClient({
  tool,
  canReceivePayments,
  hasPurchases,
}: {
  tool: Tool;
  canReceivePayments: boolean;
  hasPurchases: boolean;
}) {
  const t = useTranslations("edit");
  const tSubmit = useTranslations("submit");
  const tCategories = useTranslations("categories");
  const tCommon = useTranslations("common");
  const [price, setPrice] = useState(String(tool.price));
  const [salePrice, setSalePrice] = useState(
    tool.sale_price != null ? String(tool.sale_price) : ""
  );
  const [saleEndsAt, setSaleEndsAt] = useState(
    tool.sale_ends_at ? tool.sale_ends_at.slice(0, 16) : ""
  );
  const [saleEnabled, setSaleEnabled] = useState(tool.sale_price != null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    tool.categories?.length ? tool.categories : tool.category ? [tool.category] : []
  );

  function toggleCategory(c: string) {
    setSelectedCategories((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    );
  }
  const [uploadLabel, setUploadLabel] = useState<string | null>(null);
  const [uploadPercent, setUploadPercent] = useState(0);
  const supabaseBrowser = useMemo(() => createBrowserSupabase(), []);
  const [selectedHostApps, setSelectedHostApps] = useState<string[]>(tool.host_apps ?? []);
  function toggleHostApp(slug: string) {
    setSelectedHostApps((prev) =>
      prev.includes(slug) ? prev.filter((x) => x !== slug) : [...prev, slug]
    );
  }
  const [platforms, setPlatforms] = useState<string[]>(tool.platforms ?? []);
  const [minOsVersion, setMinOsVersion] = useState(tool.min_os_version ?? "");
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(
    tool.thumbnail_url
  );
  const [thumbnailName, setThumbnailName] = useState<string | null>(null);
  const [thumbnailSize, setThumbnailSize] = useState<number | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isTogglingStatus, startStatusTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const MAX_GALLERY_IMAGES = 5;
  const [existingGallery, setExistingGallery] = useState<string[]>(tool.gallery_urls ?? []);
  const [newGalleryFiles, setNewGalleryFiles] = useState<File[]>([]);
  const [galleryError, setGalleryError] = useState<string | null>(null);

  const priceNumber = Number(price);
  const isFree = price !== "" && priceNumber === 0;
  const fileTooLarge = fileSize !== null && fileSize > MAX_TOOL_FILE_SIZE;
  const thumbnailTooLarge =
    thumbnailSize !== null && thumbnailSize > MAX_THUMBNAIL_FILE_SIZE;
  const priceBlocked = !isFree && priceNumber > 0 && !canReceivePayments;

  function togglePlatform(p: string) {
    setPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  }

  function handleFile(file: File | undefined) {
    if (!file) return;
    // 出品時と同じく、acceptを素通りした場合に備えてここでも形式を確認する
    if (!isAllowedToolFile(file.name)) {
      setError(tSubmit("errorUnsupportedFileType"));
      return;
    }
    setError(null);
    setFileName(file.name);
    setFileSize(file.size);
    if (fileInputRef.current) {
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      fileInputRef.current.files = dataTransfer.files;
    }
  }

  async function handleThumbnail(file: File | undefined) {
    if (!file) return;
    const compressed = await compressImage(file, COMPRESS_PRESET_THUMBNAIL);
    if (thumbnailInputRef.current) {
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(compressed);
      thumbnailInputRef.current.files = dataTransfer.files;
    }
    setThumbnailName(compressed.name);
    setThumbnailSize(compressed.size);
    setThumbnailPreview((prev) => {
      if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
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
      setGalleryError(tSubmit("galleryLimitError", { remaining }));
    }

    const oversized = incoming.find((f) => f.size > MAX_THUMBNAIL_FILE_SIZE);
    if (oversized) {
      setGalleryError(
        tSubmit("galleryFileTooLargeError", {
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

  /** 送信前に、ファイル・画像をブラウザから直接Supabaseへアップロードする */
  async function prepareUploads(formData: FormData): Promise<string | null> {
    const {
      data: { user },
    } = await supabaseBrowser.auth.getUser();
    if (!user) return tSubmit("errorSessionExpired");

    const file = fileInputRef.current?.files?.[0];
    if (tool.runtime === "local" && file) {
      setUploadLabel(tSubmit("uploadingFile"));
      setUploadPercent(0);
      const result = await uploadToStorage({
        bucket: "tool-files",
        key: `${user.id}/${tool.id}/${sanitizeFileName(file.name)}`,
        file,
        onProgress: ({ percent }) => setUploadPercent(percent),
      });
      if (!result.ok) return result.error;
      formData.set("uploadedFileKey", result.key);
      formData.set("uploadedFileSize", String(file.size));
    }

    const thumb = thumbnailInputRef.current?.files?.[0];
    if (thumb) {
      setUploadLabel(tSubmit("uploadingThumbnail"));
      setUploadPercent(0);
      const result = await uploadToStorage({
        bucket: "tool-images",
        key: `${user.id}/${tool.id}/${sanitizeFileName(thumb.name)}`,
        file: thumb,
        onProgress: ({ percent }) => setUploadPercent(percent),
      });
      if (!result.ok) return result.error;
      formData.set("uploadedThumbnailUrl", result.publicUrl ?? "");
    }

    const galleryUrls: string[] = [];
    for (let i = 0; i < newGalleryFiles.length; i++) {
      const image = newGalleryFiles[i];
      setUploadLabel(tSubmit("uploadingGallery", { current: i + 1, total: newGalleryFiles.length }));
      setUploadPercent(0);
      const result = await uploadToStorage({
        bucket: "tool-images",
        key: `${user.id}/${tool.id}/gallery-${crypto.randomUUID().slice(0, 8)}-${sanitizeFileName(image.name)}`,
        file: image,
        onProgress: ({ percent }) => setUploadPercent(percent),
      });
      if (!result.ok) return result.error;
      if (result.publicUrl) galleryUrls.push(result.publicUrl);
    }
    formData.set("uploadedGalleryUrls", galleryUrls.join(","));

    formData.delete("file");
    formData.delete("thumbnail");
    formData.delete("galleryImages");

    setUploadLabel(null);
    return null;
  }

  function handleFormAction(formData: FormData) {
    setError(null);
    if (selectedCategories.length === 0) {
      setError(tSubmit("errorCategoryRequired"));
      return;
    }
    if (fileTooLarge) {
      setError(tSubmit("errorFileTooLarge", { limit: formatFileSize(MAX_TOOL_FILE_SIZE) ?? "" }));
      return;
    }
    if (thumbnailTooLarge) {
      setError(
        tSubmit("errorThumbnailTooLarge", { limit: formatFileSize(MAX_THUMBNAIL_FILE_SIZE) ?? "" })
      );
      return;
    }
    startTransition(async () => {
      // 出品時と同じく、ファイル本体はブラウザから直接Supabaseへ送る
      // （Vercelの1リクエスト4.5MB制限を回避するため）
      const uploadError = await prepareUploads(formData);
      if (uploadError) {
        setUploadLabel(null);
        setError(uploadError);
        return;
      }
      const result = await updateTool(tool.id, formData);
      if (result?.error) setError(result.error);
    });
  }

  function handleToggleStatus() {
    setError(null);
    setStatusMessage(null);
    const willPublish = tool.status !== "published";
    startStatusTransition(async () => {
      const result = await setToolPublished(tool.id, willPublish);
      if (result?.error) {
        setError(result.error);
      } else {
        setStatusMessage(
          willPublish ? t("publishedMessage") : t("unpublishedMessage")
        );
      }
    });
  }

  function handleDelete() {
    setError(null);
    startDeleteTransition(async () => {
      const result = await deleteTool(tool.id);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-2xl px-6 py-10">
        <div className="mb-1 flex items-center justify-between">
          <h1 className="font-display text-2xl font-semibold text-text-primary">
            {t("title")}
          </h1>
          <span
            className={`rounded-full px-2.5 py-1 font-mono text-[11px] font-medium ${
              tool.status === "published"
                ? "bg-accent-success/10 text-accent-success"
                : "bg-surface-raised text-text-muted"
            }`}
          >
            {tool.status === "published" ? t("statusPublished") : t("statusUnpublished")}
          </span>
        </div>
        <p className="mb-6 text-[13px] text-text-muted">
          <Link href={`/apps/${tool.slug}`} className="text-accent-signal hover:underline">
            {t("viewPage")}
          </Link>
        </p>

        {statusMessage && (
          <div className="mb-5 rounded-lg border border-accent-success/30 bg-accent-success/5 px-3.5 py-2.5 text-[13px] text-accent-success">
            {statusMessage}
          </div>
        )}
        {error && (
          <div className="mb-5 rounded-lg border border-accent-danger/30 bg-accent-danger/10 px-3.5 py-2.5 text-[13px] text-accent-danger">
            {error}
          </div>
        )}

        {/* 公開・非公開の切り替え */}
        <div className="mb-8 flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3">
          <div>
            <p className="text-[13px] font-medium text-text-primary">
              {tool.status === "published" ? t("currentlyPublished") : t("currentlyUnpublished")}
            </p>
            <p className="text-[12px] text-text-muted">
              {t("toggleHint")}
            </p>
          </div>
          <button
            type="button"
            onClick={handleToggleStatus}
            disabled={isTogglingStatus}
            className="shrink-0 rounded-lg border border-border bg-bg px-3.5 py-2 text-[13px] font-medium text-text-secondary transition hover:bg-surface-raised disabled:opacity-60"
          >
            {isTogglingStatus
              ? tCommon("processing")
              : tool.status === "published"
                ? t("unpublish")
                : t("publish")}
          </button>
        </div>

        <form action={handleFormAction} className="space-y-7">
          {/* サムネイル画像 */}
          <Field label={tSubmit("thumbnail")}>
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface">
                {thumbnailPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumbnailPreview} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="font-display text-lg font-semibold text-text-dim">
                    {tool.name.slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => thumbnailInputRef.current?.click()}
                  className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3.5 py-2 text-[13px] font-medium text-text-secondary transition hover:border-border-strong hover:bg-surface-raised"
                >
                  {tSubmit("changeImage")}
                </button>
                {thumbnailName && (
                  <p className="mt-1.5 text-[12px] text-text-secondary">
                    {thumbnailName}
                    {thumbnailSize !== null && ` ・ ${formatFileSize(thumbnailSize)}`}
                  </p>
                )}
                {thumbnailTooLarge && (
                  <p className="mt-1 text-[12px] text-accent-danger">
                    {tSubmit("thumbnailOverLimit", { limit: formatFileSize(MAX_THUMBNAIL_FILE_SIZE) ?? "" })}
                  </p>
                )}
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
          <Field label={tSubmit("gallery")}>
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
                    aria-label={tSubmit("removeImage")}
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
                  removeLabel={tSubmit("removeImage")}
                />
              ))}

              {existingGallery.length + newGalleryFiles.length < MAX_GALLERY_IMAGES && (
                <button
                  type="button"
                  onClick={() => {
                    if (galleryInputRef.current) galleryInputRef.current.value = "";
                    galleryInputRef.current?.click();
                  }}
                  className="flex h-20 w-20 shrink-0 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border text-text-dim transition hover:border-border-strong hover:text-text-muted"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  <span className="text-[11px]">{tSubmit("add")}</span>
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
              {tSubmit("galleryHint", { limit: formatFileSize(MAX_THUMBNAIL_FILE_SIZE) ?? "" })}
            </p>
          </Field>

          <input type="hidden" name="platforms" value={platforms.join(",")} readOnly />

          {/* ファイル / デモURL */}
          {tool.runtime === "local" ? (
            <Field label={tSubmit("file")}>
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
                className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition ${
                  dragOver
                    ? "border-accent-ai bg-accent-ai-dim"
                    : "border-border bg-surface hover:border-border-strong"
                }`}
              >
                {fileName ? (
                  <>
                    <p className="text-[13px] font-medium text-text-primary">{fileName}</p>
                    {fileSize !== null && (
                      <p
                        className={`mt-1 text-[12px] ${
                          fileTooLarge ? "text-accent-danger" : "text-text-muted"
                        }`}
                      >
                        {formatFileSize(fileSize)}
                        {fileTooLarge && tSubmit("fileOverLimit", { limit: formatFileSize(MAX_TOOL_FILE_SIZE) ?? "" })}
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-[13px] text-text-secondary">
                      {tool.file_key
                        ? t("keepCurrentFile")
                        : tSubmit("dropHint")}
                    </p>
                    <p className="mt-1 text-[12px] text-text-dim">
                      {tSubmit("fileTypeHint", { limit: formatFileSize(MAX_TOOL_FILE_SIZE) ?? "" })}
                    </p>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  name="file"
                  accept={TOOL_FILE_ACCEPT}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => handleFile(e.target.files?.[0])}
                  className="hidden"
                />
              </div>
            </Field>
          ) : (
            <Field label={tSubmit("demoUrl")} required>
              <input
                type="url"
                name="demoUrl"
                required
                defaultValue={tool.demo_url ?? ""}
                className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-[14px] text-text-primary outline-none focus:border-border-strong"
              />
            </Field>
          )}

          {/* ツール名 */}
          <Field label={tSubmit("toolName")} required>
            <input
              type="text"
              name="name"
              required
              defaultValue={tool.name}
              className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-[14px] text-text-primary outline-none focus:border-border-strong"
            />
          </Field>

          {/* キャッチコピー */}
          <Field label={tSubmit("tagline")} required>
            <input
              type="text"
              name="tagline"
              required
              maxLength={60}
              defaultValue={tool.tagline}
              className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-[14px] text-text-primary outline-none focus:border-border-strong"
            />
          </Field>

          {/* 詳細説明 */}
          <Field label={tSubmit("description")} required>
            <textarea
              name="description"
              required
              rows={5}
              defaultValue={tool.description}
              className="w-full resize-none rounded-lg border border-border bg-surface px-3.5 py-2.5 text-[14px] text-text-primary outline-none focus:border-border-strong"
            />
          </Field>

          {/* カテゴリ（複数選択可） */}
          <Field label={tSubmit("categoryLabel")} required>
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
                {tSubmit("categoryRequired")}
              </p>
            )}
          </Field>

          <Field label={tSubmit("hostAppsLabel")}>
            <p className="mb-2 text-[12px] text-text-dim">{tSubmit("hostAppsHint")}</p>
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
            <input type="hidden" name="hostApps" value={selectedHostApps.join(",")} readOnly />
          </Field>

          {/* 対応OS（ローカル実行のみ） */}
          {tool.runtime === "local" && (
            <Field label={tSubmit("supportedOs")} required>
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
                className="mt-3 w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-[14px] text-text-primary outline-none focus:border-border-strong"
              />
            </Field>
          )}

          {/* 価格 */}
          <Field label={tSubmit("price")} required>
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[14px] text-text-muted">
                ¥
              </span>
              <input
                type="number"
                name="price"
                required
                min={0}
                step={100}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface py-2.5 pl-8 pr-3.5 text-[14px] text-text-primary outline-none focus:border-border-strong"
              />
            </div>
            <p className="mt-2 text-[12px] text-text-dim">
              {isFree
                ? t("freePublishNotice")
                : tSubmit("priceHint", {
                    amount: priceNumber.toLocaleString(),
                    net: Math.round(priceNumber * 0.8).toLocaleString(),
                  })}
            </p>
            {tool.runtime === "cloud" && !isFree && (
              <p className="mt-2 text-[12px] font-medium leading-relaxed text-accent-danger">
                {tSubmit("cloudPaidWarning")}
              </p>
            )}
            {priceBlocked && (
              <p className="mt-2 rounded-lg border border-accent-danger/30 bg-accent-danger/5 px-3 py-2 text-[12px] text-accent-danger">
                {t.rich("payoutRequiredNotice", {
                  link: (chunks) => (
                    <a href="/seller" className="mx-1 underline">
                      {chunks}
                    </a>
                  ),
                })}
              </p>
            )}
          </Field>

          {!isFree && (
            <Field label={tSubmit("saleLabel")}>
              <input type="hidden" name="saleEnabled" value={saleEnabled ? "1" : "0"} />
              <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-text-secondary">
                <input
                  type="checkbox"
                  checked={saleEnabled}
                  onChange={(e) => setSaleEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                {tSubmit("saleEnable")}
              </label>

              {saleEnabled && (
                <div className="mt-3 space-y-3">
                  <div>
                    <p className="mb-1.5 text-[12px] text-text-dim">{tSubmit("salePriceLabel")}</p>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[14px] text-text-muted">
                        ¥
                      </span>
                      <input
                        type="number"
                        name="salePrice"
                        min={0}
                        step={100}
                        max={Math.max(0, priceNumber - 1)}
                        value={salePrice}
                        onChange={(e) => setSalePrice(e.target.value)}
                        className="w-full rounded-lg border border-border bg-surface py-2.5 pl-8 pr-3.5 text-[14px] text-text-primary outline-none focus:border-border-strong"
                      />
                    </div>
                  </div>
                  <div>
                    <p className="mb-1.5 text-[12px] text-text-dim">{tSubmit("saleEndsAtLabel")}</p>
                    <input
                      type="datetime-local"
                      name="saleEndsAt"
                      value={saleEndsAt}
                      onChange={(e) => setSaleEndsAt(e.target.value)}
                      className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-[14px] text-text-primary outline-none focus:border-border-strong"
                    />
                  </div>
                  <p className="text-[12px] text-text-dim">{tSubmit("saleHint")}</p>
                </div>
              )}
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

          <button
            type="submit"
            disabled={isPending || fileTooLarge || thumbnailTooLarge || priceBlocked}
            className="w-full rounded-lg bg-accent-signal py-3 text-sm font-medium text-white transition hover:brightness-105 disabled:opacity-60"
          >
            {isPending ? t("saving") : t("save")}
          </button>
        </form>

        {/* 削除 */}
        <div className="mt-10 rounded-lg border border-accent-danger/20 bg-accent-danger/5 p-4">
          <p className="mb-1 text-[13px] font-medium text-accent-danger">
            {t("deleteTitle")}
          </p>
          {hasPurchases ? (
            <p className="text-[12px] text-accent-danger/80">
              {t("deleteBlockedByPurchases")}
            </p>
          ) : (
            <>
              <p className="mb-3 text-[12px] text-accent-danger/80">
                {t("deleteWarning")}
              </p>
              {confirmingDelete ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="rounded-lg bg-accent-danger px-4 py-2 text-[12px] font-medium text-white transition hover:brightness-105 disabled:opacity-60"
                  >
                    {isDeleting ? t("deleting") : t("confirmDelete")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(false)}
                    className="rounded-lg border border-border bg-bg px-4 py-2 text-[12px] text-text-secondary hover:bg-surface-raised"
                  >
                    {t("cancel")}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(true)}
                  className="rounded-lg border border-accent-danger/40 bg-bg px-4 py-2 text-[12px] font-medium text-accent-danger transition hover:bg-accent-danger/10"
                >
                  {t("deleteButton")}
                </button>
              )}
            </>
          )}
        </div>
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
