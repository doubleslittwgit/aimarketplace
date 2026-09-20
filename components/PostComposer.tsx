"use client";

import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { createPost, type PostItem } from "@/app/feed/actions";

export default function PostComposer({
  onPosted,
}: {
  onPosted: (post: PostItem) => void;
}) {
  const t = useTranslations("feed");
  const [content, setContent] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function pickImage(file: File | undefined) {
    if (!file) return;
    setImageFile(file);
    setImagePreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  }

  function clearImage() {
    setImageFile(null);
    setImagePreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleSubmit() {
    setError(null);
    const formData = new FormData();
    formData.set("content", content);
    if (imageFile) formData.set("image", imageFile);

    startTransition(async () => {
      const result = await createPost(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.post) onPosted(result.post);
      setContent("");
      clearImage();
    });
  }

  return (
    <div className="mb-6 rounded-xl border border-border bg-surface p-4">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={t("composerPlaceholder")}
        rows={3}
        maxLength={500}
        className="w-full resize-none border-none bg-transparent text-[14px] text-text-primary outline-none placeholder:text-text-dim"
      />

      {imagePreview && (
        <div className="relative mt-2 inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imagePreview} alt="" className="max-h-56 rounded-lg border border-border" />
          <button
            type="button"
            onClick={clearImage}
            className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-text-primary text-white shadow-sm"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {error && <p className="mt-2 text-[12px] text-accent-danger">{error}</p>}

      <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] text-text-muted transition hover:bg-surface-raised hover:text-text-secondary"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="9" cy="9" r="2" />
            <path d="m21 15-5-5L5 21" />
          </svg>
          {t("addImage")}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(e) => pickImage(e.target.files?.[0])}
          className="hidden"
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending || (!content.trim() && !imageFile)}
          className="rounded-full bg-accent-signal px-5 py-1.5 text-[13px] font-medium text-white transition hover:brightness-105 disabled:opacity-50"
        >
          {isPending ? t("posting") : t("post")}
        </button>
      </div>
    </div>
  );
}
