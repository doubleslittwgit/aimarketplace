"use client";

import { useState, useTransition, useRef } from "react";
import Link from "next/link";
import { categories, MAX_TOOL_FILE_SIZE, MAX_THUMBNAIL_FILE_SIZE, formatFileSize } from "@/lib/mock-data";
import { updateTool, setToolPublished, deleteTool } from "./actions";

type Tool = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  category: string;
  price: number;
  runtime: "cloud" | "local";
  platforms: string[] | null;
  min_os_version: string | null;
  demo_url: string | null;
  thumbnail_url: string | null;
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
  const [price, setPrice] = useState(String(tool.price));
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
    setFileName(file.name);
    setFileSize(file.size);
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
      if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  }

  function handleFormAction(formData: FormData) {
    setError(null);
    if (fileTooLarge) {
      setError(`ファイルサイズが上限(${formatFileSize(MAX_TOOL_FILE_SIZE)})を超えています`);
      return;
    }
    if (thumbnailTooLarge) {
      setError(
        `サムネイル画像のサイズが上限(${formatFileSize(MAX_THUMBNAIL_FILE_SIZE)})を超えています`
      );
      return;
    }
    startTransition(async () => {
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
          willPublish
            ? "公開しました。反映まで少し時間がかかる場合があります。"
            : "非公開にしました。購入済みの方は引き続きダウンロードできます。"
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
            ツールを編集
          </h1>
          <span
            className={`rounded-full px-2.5 py-1 font-mono text-[11px] font-medium ${
              tool.status === "published"
                ? "bg-accent-success/10 text-accent-success"
                : "bg-surface-raised text-text-muted"
            }`}
          >
            {tool.status === "published" ? "公開中" : "非公開"}
          </span>
        </div>
        <p className="mb-6 text-[13px] text-text-muted">
          <Link href={`/apps/${tool.slug}`} className="text-accent-signal hover:underline">
            商品ページを見る
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
              {tool.status === "published" ? "現在、公開されています" : "現在、非公開です"}
            </p>
            <p className="text-[12px] text-text-muted">
              非公開にすると検索・一覧に表示されなくなります（購入済みの方は引き続きダウンロード可能）
            </p>
          </div>
          <button
            type="button"
            onClick={handleToggleStatus}
            disabled={isTogglingStatus}
            className="shrink-0 rounded-lg border border-border bg-bg px-3.5 py-2 text-[13px] font-medium text-text-secondary transition hover:bg-surface-raised disabled:opacity-60"
          >
            {isTogglingStatus
              ? "処理中..."
              : tool.status === "published"
                ? "非公開にする"
                : "公開する"}
          </button>
        </div>

        <form action={handleFormAction} className="space-y-7">
          {/* サムネイル画像 */}
          <Field label="サムネイル画像">
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
                  画像を変更
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

          <input type="hidden" name="platforms" value={platforms.join(",")} readOnly />

          {/* ファイル / デモURL */}
          {tool.runtime === "local" ? (
            <Field label="ファイル">
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
                        {fileTooLarge && `（上限${formatFileSize(MAX_TOOL_FILE_SIZE)}を超えています）`}
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-[13px] text-text-secondary">
                      {tool.file_key
                        ? "現在のファイルを維持します（変更する場合はここにドラッグ）"
                        : "ここにファイルをドラッグ、またはクリックして選択"}
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
                defaultValue={tool.demo_url ?? ""}
                className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-[14px] text-text-primary outline-none focus:border-border-strong"
              />
            </Field>
          )}

          {/* ツール名 */}
          <Field label="ツール名" required>
            <input
              type="text"
              name="name"
              required
              defaultValue={tool.name}
              className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-[14px] text-text-primary outline-none focus:border-border-strong"
            />
          </Field>

          {/* キャッチコピー */}
          <Field label="一言説明（キャッチコピー）" required>
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
          <Field label="詳細説明" required>
            <textarea
              name="description"
              required
              rows={5}
              defaultValue={tool.description}
              className="w-full resize-none rounded-lg border border-border bg-surface px-3.5 py-2.5 text-[14px] text-text-primary outline-none focus:border-border-strong"
            />
          </Field>

          {/* カテゴリ */}
          <Field label="カテゴリ" required>
            <select
              name="category"
              required
              defaultValue={tool.category}
              className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-[14px] text-text-primary outline-none focus:border-border-strong"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>

          {/* 対応OS（ローカル実行のみ） */}
          {tool.runtime === "local" && (
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
                className="mt-3 w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-[14px] text-text-primary outline-none focus:border-border-strong"
              />
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
                className="w-full rounded-lg border border-border bg-surface py-2.5 pl-8 pr-3.5 text-[14px] text-text-primary outline-none focus:border-border-strong"
              />
            </div>
            <p className="mt-2 text-[12px] text-text-dim">
              {isFree
                ? "無料ツールとして公開されます"
                : `${priceNumber.toLocaleString()}円で販売されます（手数料20%を差し引いた¥${Math.round(priceNumber * 0.8).toLocaleString()}が売上になります）`}
            </p>
            {tool.runtime === "cloud" && !isFree && (
              <p className="mt-2 text-[12px] font-medium leading-relaxed text-accent-danger">
                ご注意：クラウド型はURLを知っている人なら誰でもアクセスできてしまうため、
                第三者がURLを流用し、無断で無料公開してしまう恐れがあります。
                ログイン必須にする等、アクセス制限をご自身のサービス側で設けることを推奨します。
              </p>
            )}
            {priceBlocked && (
              <p className="mt-2 rounded-lg border border-accent-danger/30 bg-accent-danger/5 px-3 py-2 text-[12px] text-accent-danger">
                有料で公開するには、先に
                <a href="/seller" className="mx-1 underline">
                  売上の受け取り設定
                </a>
                を完了してください。
              </p>
            )}
          </Field>

          <button
            type="submit"
            disabled={isPending || fileTooLarge || thumbnailTooLarge || priceBlocked}
            className="w-full rounded-lg bg-accent-signal py-3 text-sm font-medium text-white transition hover:brightness-105 disabled:opacity-60"
          >
            {isPending ? "保存中..." : "変更を保存する"}
          </button>
        </form>

        {/* 削除 */}
        <div className="mt-10 rounded-lg border border-accent-danger/20 bg-accent-danger/5 p-4">
          <p className="mb-1 text-[13px] font-medium text-accent-danger">
            このツールを完全に削除する
          </p>
          {hasPurchases ? (
            <p className="text-[12px] text-accent-danger/80">
              購入者がいるため削除できません。上の「非公開にする」をお使いください。
            </p>
          ) : (
            <>
              <p className="mb-3 text-[12px] text-accent-danger/80">
                この操作は取り消せません。ファイルもあわせて削除されます。
              </p>
              {confirmingDelete ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="rounded-lg bg-accent-danger px-4 py-2 text-[12px] font-medium text-white transition hover:brightness-105 disabled:opacity-60"
                  >
                    {isDeleting ? "削除中..." : "本当に削除する"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(false)}
                    className="rounded-lg border border-border bg-bg px-4 py-2 text-[12px] text-text-secondary hover:bg-surface-raised"
                  >
                    キャンセル
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(true)}
                  className="rounded-lg border border-accent-danger/40 bg-bg px-4 py-2 text-[12px] font-medium text-accent-danger transition hover:bg-accent-danger/10"
                >
                  削除する
                </button>
              )}
            </>
          )}
        </div>
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
