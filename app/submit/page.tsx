"use client";

import { useState } from "react";
import Header from "@/components/Header";
import { categories } from "@/lib/mock-data";

export default function SubmitPage() {
  const [price, setPrice] = useState("");
  const [runtime, setRuntime] = useState<"cloud" | "local">("cloud");
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const priceNumber = Number(price);
  const isFree = price !== "" && priceNumber === 0;

  function handleFile(file: File | undefined) {
    if (!file) return;
    setFileName(file.name);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // MVP段階ではDB接続前なので、送信の代わりに完了画面を表示するだけ
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <>
        <Header />
        <main className="flex flex-1 items-center justify-center px-6 py-20">
          <div className="max-w-md text-center">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-accent-signal-dim">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                className="text-accent-signal"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
            <h1 className="mb-2 font-display text-xl font-semibold text-text-primary">
              送信内容を受け付けました
            </h1>
            <p className="text-[14px] text-text-secondary">
              現在この画面はデモ表示です。実際の審査・公開機能は準備中です。
            </p>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header />

      <main className="flex-1">
        <div className="mx-auto max-w-2xl px-6 py-10">
          <h1 className="mb-1 font-display text-2xl font-semibold text-text-primary">
            ツールを公開する
          </h1>
          <p className="mb-8 text-[13px] text-text-muted">
            価格は0円から、あなたが決められます。無料公開もいつでも有料に切り替えられます。
          </p>

          <form onSubmit={handleSubmit} className="space-y-7">
            {/* ファイルアップロード */}
            <Field label="ファイル または デモURL" required>
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
                  className="mt-4 text-[12px] text-text-secondary"
                  onChange={(e) => handleFile(e.target.files?.[0])}
                />
              </div>
              <p className="mt-2 text-[12px] text-text-dim">
                クラウド上で動くWebアプリの場合は、ファイルの代わりにデモURLを貼り付けても構いません
              </p>
            </Field>

            {/* ツール名 */}
            <Field label="ツール名" required>
              <input
                type="text"
                required
                placeholder="例：InvoiceParser AI"
                className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-[14px] text-text-primary outline-none placeholder:text-text-dim focus:border-border-strong"
              />
            </Field>

            {/* キャッチコピー */}
            <Field label="一言説明（キャッチコピー）" required>
              <input
                type="text"
                required
                maxLength={60}
                placeholder="例：請求書PDFを3秒でスプレッドシートに変換"
                className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-[14px] text-text-primary outline-none placeholder:text-text-dim focus:border-border-strong"
              />
            </Field>

            {/* 詳細説明 */}
            <Field label="詳細説明" required>
              <textarea
                required
                rows={5}
                placeholder="このツールが何を解決するか、どう使うかを説明してください"
                className="w-full resize-none rounded-lg border border-border bg-surface px-3.5 py-2.5 text-[14px] text-text-primary outline-none placeholder:text-text-dim focus:border-border-strong"
              />
            </Field>

            {/* カテゴリ */}
            <Field label="カテゴリ" required>
              <select
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

            {/* 価格 */}
            <Field label="価格" required>
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[14px] text-text-muted">
                  ¥
                </span>
                <input
                  type="number"
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
              className="w-full rounded-lg bg-accent-signal py-3 text-sm font-medium text-white transition hover:brightness-105"
            >
              公開する
            </button>
          </form>
        </div>
      </main>
    </>
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
