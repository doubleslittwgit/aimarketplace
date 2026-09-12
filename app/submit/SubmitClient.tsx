"use client";

import { useState, useTransition } from "react";
import { categories } from "@/lib/mock-data";
import { createTool } from "./actions";

export default function SubmitClient() {
  const [price, setPrice] = useState("");
  const [runtime, setRuntime] = useState<"cloud" | "local">("cloud");
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [minOsVersion, setMinOsVersion] = useState("");
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function togglePlatform(p: string) {
    setPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  }

  const priceNumber = Number(price);
  const isFree = price !== "" && priceNumber === 0;

  function handleFile(file: File | undefined) {
    if (!file) return;
    setFileName(file.name);
  }

  function handleThumbnail(file: File | undefined) {
    if (!file) return;
    setThumbnailPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  }

  function handleFormAction(formData: FormData) {
    setError(null);
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
          価格は0円から、あなたが決められます。無料公開もいつでも有料に切り替えられます。
        </p>

        <form action={handleFormAction} className="space-y-7">
          {error && (
            <div className="rounded-lg border border-accent-danger/30 bg-accent-danger/10 px-3.5 py-2.5 text-[13px] text-accent-danger">
              {error}
            </div>
          )}

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
                <input
                  type="file"
                  name="thumbnail"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => handleThumbnail(e.target.files?.[0])}
                  className="text-[12px] text-text-secondary"
                />
                <p className="mt-1.5 text-[12px] text-text-dim">
                  未設定の場合は、ツール名の頭文字が自動で表示されます（推奨:正方形・PNG/JPEG）
                </p>
              </div>
            </div>
          </Field>

          {/* 実行環境に応じて、ファイルアップロード or デモURL のどちらかを表示 */}
          <input type="hidden" name="runtime" value={runtime} />
          <input type="hidden" name="platforms" value={platforms.join(",")} readOnly />

          {runtime === "local" ? (
            <Field label="ファイル" required>
              <div
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
                className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition ${
                  dragOver
                    ? "border-accent-ai bg-accent-ai-dim"
                    : "border-border bg-surface"
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
                  <p className="text-[13px] font-medium text-text-primary">
                    {fileName}
                  </p>
                ) : (
                  <>
                    <p className="text-[13px] text-text-secondary">
                      ここにファイルをドラッグ、またはクリックして選択
                    </p>
                    <p className="mt-1 text-[12px] text-text-dim">
                      ZIP / EXE / APP　最大300MBまで
                    </p>
                  </>
                )}
                <input
                  type="file"
                  name="file"
                  required
                  className="mt-4 text-[12px] text-text-secondary"
                  onChange={(e) => handleFile(e.target.files?.[0])}
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

          {/* 価格 */}
          <Field label="価格" required>
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
                placeholder="0"
                className="w-full rounded-lg border border-border bg-surface py-2.5 pl-8 pr-3.5 text-[14px] text-text-primary outline-none placeholder:text-text-dim focus:border-border-strong"
              />
            </div>
            <p className="mt-2 text-[12px] text-text-dim">
              {price === ""
                ? "0円を入力すると無料公開になります"
                : isFree
                  ? "無料ツールとして公開されます"
                  : `${priceNumber.toLocaleString()}円で販売されます（手数料20%を差し引いた¥${Math.round(priceNumber * 0.8).toLocaleString()}が売上になります）`}
            </p>
          </Field>

          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-lg bg-accent-signal py-3 text-sm font-medium text-white transition hover:brightness-105 disabled:opacity-60"
          >
            {isPending ? "公開処理中..." : "公開する"}
          </button>
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
