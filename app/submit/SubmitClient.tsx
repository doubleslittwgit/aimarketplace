"use client";

import { useState, useTransition, useRef, useEffect, useMemo } from "react";
import { categories, MAX_TOOL_FILE_SIZE, MAX_THUMBNAIL_FILE_SIZE, formatFileSize } from "@/lib/mock-data";
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
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
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

  function handleThumbnail(file: File | undefined) {
    if (!file) return;
    setThumbnailName(file.name);
    setThumbnailSize(file.size);
    setThumbnailPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  }

  /** newGalleryFilesの内容を、隠しinput(name="galleryImages")のfilesに反映する */
  function syncGalleryInput(files: File[]) {
    if (!galleryInputRef.current) return;
    const dataTransfer = new DataTransfer();
    files.forEach((f) => dataTransfer.items.add(f));
    galleryInputRef.current.files = dataTransfer.files;
  }

  function handleGalleryAdd(selected: FileList | null) {
    if (!selected) return;
    setGalleryError(null);
    const remaining = MAX_GALLERY_IMAGES - existingGallery.length - newGalleryFiles.length;
    const incoming = Array.from(selected);

    if (incoming.length > remaining) {
      setGalleryError(`追加できるのはあと${remaining}枚までです`);
    }

    const oversized = incoming.find((f) => f.size > MAX_THUMBNAIL_FILE_SIZE);
    if (oversized) {
      setGalleryError(
        `「${oversized.name}」は上限(${formatFileSize(MAX_THUMBNAIL_FILE_SIZE)})を超えています`
      );
    }

    const accepted = incoming
      .filter((f) => f.size <= MAX_THUMBNAIL_FILE_SIZE)
      .slice(0, Math.max(0, remaining));

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

  function handleFormAction(formData: FormData) {
    setError(null);
    if (selectedCategories.length === 0) {
      setError("カテゴリを少なくとも1つ選んでください");
      return;
    }
    if (fileTooLarge) {
      setError(
        `ファイルサイズが上限(${formatFileSize(MAX_TOOL_FILE_SIZE)})を超えています`
      );
      return;
    }
    if (thumbnailTooLarge) {
      setError(
        `サムネイル画像のサイズが上限(${formatFileSize(MAX_THUMBNAIL_FILE_SIZE)})を超えています`
      );
      return;
    }
    startTransition(async () => {
      const result = await createTool(formData);
      if (result?.error) setError(result.error);
    });
  }

  function handleSaveDraft() {
    if (!formRef.current) return;
    setError(null);
    const formData = new FormData(formRef.current);
    startSaveDraft(async () => {
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
          {initialDraft ? "下書きの続きを書く" : "ツールを公開する"}
        </h1>
        <p className="mb-8 text-[13px] text-text-muted">
          {initialDraft
            ? "続きを入力して、公開するか、また後で続きを書くか選べます。"
            : "まずは無料公開か有料販売かを選んでください。無料公開は登録なしですぐに始められます。"}
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
              公開方法
              <span className="ml-1 text-accent-signal">*</span>
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <PriceTypeOption
                label="無料"
                description="誰でもすぐにダウンロードできます"
                active={priceType === "free"}
                onClick={() => {
                  setPriceType("free");
                  setPrice("0");
                }}
              />
              <PriceTypeOption
                label="有料"
                description="購入した人だけがダウンロードできます"
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
                  先に売上の受け取り設定が必要です
                </p>
                <ol className="mb-3 space-y-1.5">
                  {[
                    "「受け取り設定に進む」からStripeの登録画面に移動します",
                    "本人確認の情報と、入金先の銀行口座を登録します",
                    "審査が通ると、有料ツールを公開できるようになります",
                  ].map((text, i) => (
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
                  受け取り設定に進む
                </a>
              </div>
            )}

            {/* 有料 & 受け取り設定済み → 価格入力欄を出す */}
            {priceType === "paid" && canReceivePayments && (
              <div className="mt-4">
                <label className="mb-1.5 block text-[12px] text-text-muted">
                  価格
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
                    ? `${priceNumber.toLocaleString()}円で販売されます（手数料20%を差し引いた¥${Math.round(priceNumber * 0.8).toLocaleString()}が売上になります）`
                    : "1円以上を入力してください"}
                </p>
              </div>
            )}

            {priceType === "free" && (
              <input type="hidden" name="price" value="0" />
            )}
          </div>

          {/* 実行環境（無料/有料の次に決める、重要な設定のため） */}
          {(priceType === "free" || (priceType === "paid" && canReceivePayments)) && (
            <Field label="実行環境" required>
              <div className="flex gap-3">
                <RuntimeOption
                  label="クラウド（Web）"
                  description="サーバー上で動作。ブラウザだけで使える"
                  active={runtime === "cloud"}
                  onClick={() => setRuntime("cloud")}
                />
                <RuntimeOption
                  label="ローカル実行"
                  description="ダウンロードして使用。データが外に出ない"
                  active={runtime === "local"}
                  onClick={() => setRuntime("local")}
                />
              </div>

              {priceType === "paid" && runtime === "cloud" && (
                <p className="mt-3 text-[12px] font-medium leading-relaxed text-accent-danger">
                  ご注意：クラウド型はURLを知っている人なら誰でもアクセスできてしまうため、
                  第三者がURLを流用し、無断で無料公開してしまう恐れがあります。
                  ログイン必須にする等、アクセス制限をご自身のサービス側で設けることを推奨します。
                </p>
              )}
            </Field>
          )}

          {showForm && (
            <>
              {/* サムネイル画像 */}
              <Field label="サムネイル画像">
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
                      {thumbnailName ? "画像を変更" : "画像を選択"}
                    </button>
                    {thumbnailName && (
                      <p className="mt-1.5 text-[12px] text-text-secondary">
                        {thumbnailName}
                        {thumbnailSize !== null && ` ・ ${formatFileSize(thumbnailSize)}`}
                      </p>
                    )}
                    {thumbnailTooLarge && (
                      <p className="mt-1 text-[12px] text-accent-danger">
                        上限({formatFileSize(MAX_THUMBNAIL_FILE_SIZE)})を超えています
                      </p>
                    )}
                    <p className="mt-1.5 text-[12px] text-text-dim">
                      未設定の場合は、ツール名の頭文字が自動で表示されます（推奨:正方形・PNG/JPEG、最大{formatFileSize(MAX_THUMBNAIL_FILE_SIZE)}）
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
              <Field label="紹介画像（最大5枚）">
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
                        aria-label="この画像を削除"
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
                      <span className="text-[11px]">追加</span>
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
                  商品詳細ページで、サムネイルと合わせて矢印で切り替えながら見られます（1枚あたり最大{formatFileSize(MAX_THUMBNAIL_FILE_SIZE)}）
                </p>
              </Field>

              {/* 実行環境に応じて、ファイルアップロード or デモURL のどちらかを表示 */}
              <input type="hidden" name="runtime" value={runtime} />
              <input type="hidden" name="platforms" value={platforms.join(",")} readOnly />

              {runtime === "local" ? (
                <Field label="ファイル" required>
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
                              `（上限${formatFileSize(MAX_TOOL_FILE_SIZE)}を超えています）`}
                          </p>
                        )}
                      </>
                    ) : (
                      <>
                        <p className="text-[13px] text-text-secondary">
                          ここにファイルをドラッグ、またはクリックして選択
                        </p>
                        <p className="mt-1 text-[12px] text-text-dim">
                          ZIP / EXE / APP　最大{formatFileSize(MAX_TOOL_FILE_SIZE)}まで
                        </p>
                      </>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      name="file"
                      required={!fileName}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => handleFile(e.target.files?.[0])}
                      className="hidden"
                    />
                  </div>
                </Field>
              ) : (
                <Field label="デモURL" required>
                  <input
                    type="url"
                    name="demoUrl"
                    required
                    defaultValue={initialDraft?.demoUrl ?? ""}
                    placeholder="https://your-tool.vercel.app"
                    className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-[14px] text-text-primary outline-none placeholder:text-text-dim focus:border-border-strong"
                  />
                  <p className="mt-2 text-[12px] text-text-dim">
                    購入者がアクセスして実際に使うURLを入力してください
                  </p>
                </Field>
              )}

              {/* ツール名 */}
              <Field label="ツール名" required>
                <input
                  type="text"
                  name="name"
                  required
                  defaultValue={initialDraft?.name}
                  placeholder="例：InvoiceParser AI"
                  className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-[14px] text-text-primary outline-none placeholder:text-text-dim focus:border-border-strong"
                />
              </Field>

              {/* キャッチコピー */}
              <Field label="一言説明（キャッチコピー）" required>
                <input
                  type="text"
                  name="tagline"
                  required
                  maxLength={60}
                  defaultValue={initialDraft?.tagline}
                  placeholder="例：請求書PDFを3秒でスプレッドシートに変換"
                  className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-[14px] text-text-primary outline-none placeholder:text-text-dim focus:border-border-strong"
                />
              </Field>

              {/* 詳細説明 */}
              <Field label="詳細説明" required>
                <textarea
                  name="description"
                  required
                  rows={5}
                  defaultValue={initialDraft?.description}
                  placeholder="このツールが何を解決するか、どう使うかを説明してください"
                  className="w-full resize-none rounded-lg border border-border bg-surface px-3.5 py-2.5 text-[14px] text-text-primary outline-none placeholder:text-text-dim focus:border-border-strong"
                />
              </Field>

              {/* カテゴリ（複数選択可） */}
              <Field label="カテゴリ（複数選択可）" required>
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
                      {c}
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
                    少なくとも1つ選んでください
                  </p>
                )}
              </Field>

              {/* 対応環境 */}
              {runtime === "local" ? (
                <Field label="対応OS" required>
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
                    placeholder="例：Windows 10以降 / macOS 12 Monterey以降"
                    className="mt-3 w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-[14px] text-text-primary outline-none placeholder:text-text-dim focus:border-border-strong"
                  />
                  <p className="mt-2 text-[12px] text-text-dim">
                    対応OSと最低バージョンを明記してください。購入者が動作確認できずトラブルになるのを防ぎます
                  </p>
                </Field>
              ) : (
                <Field label="推奨環境">
                  <input
                    type="text"
                    name="minOsVersion"
                    defaultValue={initialDraft?.minOsVersion || "Chrome / Edge / Safari 最新版"}
                    className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-[14px] text-text-primary outline-none placeholder:text-text-dim focus:border-border-strong"
                  />
                  <p className="mt-2 text-[12px] text-text-dim">
                    クラウド型でも、推奨ブラウザを記載すると購入者に安心感を与えられます
                  </p>
                </Field>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={isPending || fileTooLarge || thumbnailTooLarge || !priceValid}
                  className="flex-1 rounded-lg bg-accent-signal py-3 text-sm font-medium text-white transition hover:brightness-105 disabled:opacity-60"
                >
                  {isPending ? "公開処理中..." : "公開する"}
                </button>
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  disabled={isSavingDraft}
                  className="rounded-lg border border-border bg-surface px-5 py-3 text-sm font-medium text-text-secondary transition hover:bg-surface-raised disabled:opacity-60"
                >
                  {isSavingDraft ? "保存中..." : "下書き保存"}
                </button>
              </div>
              {draftSavedAt && (
                <p className="text-[12px] text-text-muted">
                  {draftSavedAt.toLocaleTimeString("ja-JP")}
                  に下書きを保存しました。マイページからいつでも続きを書けます。
                </p>
              )}
            </>
          )}
        </form>
      </div>
    </main>
  );
}

function GalleryFilePreview({ file, onRemove }: { file: File; onRemove: () => void }) {
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
        aria-label="この画像を削除"
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
