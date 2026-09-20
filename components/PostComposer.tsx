"use client";

import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { createPost, type PostItem } from "@/app/feed/actions";
import { MAX_POST_IMAGES } from "@/app/feed/constants";

export default function PostComposer({
  onPosted,
}: {
  onPosted: (post: PostItem) => void;
}) {
  const t = useTranslations("feed");
  const [content, setContent] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function addImages(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    const incoming = Array.from(files);
    const remaining = MAX_POST_IMAGES - images.length;

    if (incoming.length > remaining) {
      setError(t("tooManyImages", { max: MAX_POST_IMAGES }));
    }

    const accepted = incoming.slice(0, Math.max(remaining, 0));
    if (accepted.length === 0) return;

    setImages((prev) => [...prev, ...accepted]);
    setPreviews((prev) => [...prev, ...accepted.map((f) => URL.createObjectURL(f))]);
  }

  function removeImage(index: number) {
    setPreviews((prev) => {
      const url = prev[index];
      if (url) URL.revokeObjectURL(url);
      return prev.filter((_, i) => i !== index);
    });
    setImages((prev) => prev.filter((_, i) => i !== index));
  }

  function clearImages() {
    previews.forEach((url) => URL.revokeObjectURL(url));
    setImages([]);
    setPreviews([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleSubmit() {
    setError(null);
    const formData = new FormData();
    formData.set("content", content);
    images.forEach((file) => formData.append("images", file));

    startTransition(async () => {
      const result = await createPost(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.post) onPosted(result.post);
      setContent("");
      clearImages();
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

      {previews.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {previews.map((src, i) => (
            <div key={src} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-24 w-24 rounded-lg border border-border object-cover" />
              <button
                type="button"
                onClick={() => removeImage(i)}
                aria-label={t("removeImage")}
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-text-primary text-white shadow-sm"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {error && <p className="mt-2 text-[12px] text-accent-danger">{error}</p>}

      <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={images.length >= MAX_POST_IMAGES}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] text-text-muted transition hover:bg-surface-raised hover:text-text-secondary disabled:opacity-40"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="9" cy="9" r="2" />
            <path d="m21 15-5-5L5 21" />
          </svg>
          {t("addImage")}
          {images.length > 0 && ` (${images.length}/${MAX_POST_IMAGES})`}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          onChange={(e) => addImages(e.target.files)}
          className="hidden"
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending || (!content.trim() && images.length === 0)}
          className="rounded-full bg-accent-signal px-5 py-1.5 text-[13px] font-medium text-white transition hover:brightness-105 disabled:opacity-50"
        >
          {isPending ? t("posting") : t("post")}
        </button>
      </div>
    </div>
  );
}
