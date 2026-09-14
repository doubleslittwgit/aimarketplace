"use client";

import { useState, useTransition, useRef } from "react";
import { categories, MAX_TOOL_FILE_SIZE, MAX_THUMBNAIL_FILE_SIZE, formatFileSize } from "@/lib/mock-data";
import { createTool } from "./actions";

type PriceType = "free" | "paid" | null;

export default function SubmitClient({
  canReceivePayments,
}: {
  canReceivePayments: boolean;
}) {
  const [priceType, setPriceType] = useState<PriceType>(null);
  const [price, setPrice] = useState("");
  const [runtime, setRuntime] = useState<"cloud" | "local">("cloud");
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [minOsVersion, setMinOsVersion] = useState("");
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [thumbnailName, setThumbnailName] = useState<string | null>(null);
  const [thumbnailSize, setThumbnailSize] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);

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

  function handleFormAction(formData: FormData) {
    setError(null);
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

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="mb-1 font-display text-2xl font-semibold text-text-primary">
          ツールを公開する
        </h1>
        <p className="mb-8 text-[13px] text-text-muted">
          まずは無料公開か有料販売かを選んでください。無料公開は登録なしですぐに始められます。
        </p>

        <form action={handleFormAction} className="space-y-7">
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
            <div className="grid grid-cols-2 gap-3">
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
                      required
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
                  placeholder="このツールが何を解決するか、どう使うかを説明してください"
                  className="w-full resize-none rounded-lg border border-border bg-surface px-3.5 py-2.5 text-[14px] text-text-primary outline-none placeholder:text-text-dim focus:border-border-strong"
                />
              </Field>

              {/* カテゴリ */}
              <Field label="カテゴリ" required>
                <select
                  name="category"
                  required
                  defaultValue=""
                  className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-[14px] text-text-primary outline-none focus:border-border-strong"
                >
                  <option value="" disabled>
                    選択してください
                  </option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </Field>

              {/* 実行環境 */}
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
                    defaultValue="Chrome / Edge / Safari 最新版"
                    className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-[14px] text-text-primary outline-none placeholder:text-text-dim focus:border-border-strong"
                  />
                  <p className="mt-2 text-[12px] text-text-dim">
                    クラウド型でも、推奨ブラウザを記載すると購入者に安心感を与えられます
                  </p>
                </Field>
              )}

              <button
                type="submit"
                disabled={isPending || fileTooLarge || thumbnailTooLarge || !priceValid}
                className="w-full rounded-lg bg-accent-signal py-3 text-sm font-medium text-white transition hover:brightness-105 disabled:opacity-60"
              >
                {isPending ? "公開処理中..." : "公開する"}
              </button>
            </>
          )}
        </form>
      </div>
    </main>
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
