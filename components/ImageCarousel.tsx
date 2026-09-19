"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

export default function ImageCarousel({
  images,
  fallbackLabel,
}: {
  images: string[];
  fallbackLabel: string;
}) {
  const t = useTranslations("toolDetail");
  const [index, setIndex] = useState(0);

  if (images.length === 0) {
    return (
      <div className="relative mb-8 aspect-video overflow-hidden rounded-xl border border-border bg-gradient-to-br from-surface-raised to-surface">
        <span className="absolute inset-0 flex items-center justify-center font-display text-5xl font-semibold text-text-dim/40">
          {fallbackLabel}
        </span>
      </div>
    );
  }

  function goTo(next: number) {
    setIndex((next + images.length) % images.length);
  }

  return (
    <div className="mb-8">
      <div className="group relative aspect-video overflow-hidden rounded-xl border border-border bg-surface-raised">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={images[index]}
          alt=""
          className="h-full w-full object-cover"
        />

        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => goTo(index - 1)}
              aria-label={t("previousImage")}
              className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-bg/80 text-text-primary opacity-0 shadow-sm backdrop-blur-sm transition hover:bg-bg group-hover:opacity-100"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => goTo(index + 1)}
              aria-label={t("nextImage")}
              className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-bg/80 text-text-primary opacity-0 shadow-sm backdrop-blur-sm transition hover:bg-bg group-hover:opacity-100"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </button>

            <div className="absolute bottom-2.5 left-1/2 flex -translate-x-1/2 gap-1.5">
              {images.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => goTo(i)}
                  aria-label={t("viewImageN", { n: i + 1 })}
                  className={`h-1.5 rounded-full transition-all ${
                    i === index ? "w-4 bg-bg" : "w-1.5 bg-bg/60"
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {images.length > 1 && (
        <div className="mt-2.5 flex gap-2 overflow-x-auto">
          {images.map((src, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              className={`h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 transition ${
                i === index ? "border-accent-signal" : "border-transparent opacity-70 hover:opacity-100"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
