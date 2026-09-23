"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { VideoEmbed } from "@/lib/video-embed";

type Slide = { kind: "video"; embed: VideoEmbed } | { kind: "image"; src: string };

/**
 * 商品ページのメディア表示（動画＋サムネイル＋紹介画像）。
 *
 * 紹介動画がある場合は、それを1枚目のスライドにする。動いている様子は
 * 静止画より伝わる情報量が多いため、最初に目に入る位置に置いている。
 *
 * 動画は「表示中のスライドのときだけ」iframeを描画する。
 * 隠すだけにすると、別のスライドへ移っても裏で再生が続いてしまうため。
 */
export default function ImageCarousel({
  images,
  video,
  fallbackLabel,
}: {
  images: string[];
  /** サーバー側で解析済みの埋め込み情報（関数ではなくデータとして受け取る） */
  video?: VideoEmbed | null;
  fallbackLabel: string;
}) {
  const t = useTranslations("toolDetail");
  const [index, setIndex] = useState(0);

  const slides: Slide[] = [
    ...(video ? [{ kind: "video" as const, embed: video }] : []),
    ...images.map((src) => ({ kind: "image" as const, src })),
  ];

  if (slides.length === 0) {
    return (
      <div className="relative mb-8 aspect-video overflow-hidden rounded-xl border border-border bg-gradient-to-br from-surface-raised to-surface">
        <span className="absolute inset-0 flex items-center justify-center font-display text-5xl font-semibold text-text-dim/40">
          {fallbackLabel}
        </span>
      </div>
    );
  }

  function goTo(next: number) {
    setIndex((next + slides.length) % slides.length);
  }

  const current = slides[index];

  // 矢印ボタンは、マウスのあるPCではホバー時だけ表示するが、
  // ホバーという操作が無いスマホでは常に表示する（見えないと押せないため）
  const arrowClass =
    "absolute top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-bg/80 text-text-primary shadow-sm backdrop-blur-sm transition hover:bg-bg md:opacity-0 md:group-hover:opacity-100";

  return (
    <div className="mb-8">
      <div className="group relative aspect-video overflow-hidden rounded-xl border border-border bg-black">
        {current.kind === "video" ? (
          <iframe
            key={current.embed.embedUrl}
            src={current.embed.embedUrl}
            title={t("videoSlide")}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={current.src} alt="" className="h-full w-full bg-surface-raised object-cover" />
        )}

        {slides.length > 1 && (
          <>
            {/* 動画の再生ボタンと重ならないよう、左右の端に寄せている */}
            <button
              type="button"
              onClick={() => goTo(index - 1)}
              aria-label={t("previousImage")}
              className={`${arrowClass} left-2`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => goTo(index + 1)}
              aria-label={t("nextImage")}
              className={`${arrowClass} right-2`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </button>

            {/* 動画の場合は、プレイヤー下部の操作バーと重ならないよう位置のドットを出さない */}
            {current.kind === "image" && (
              <div className="absolute bottom-2.5 left-1/2 flex -translate-x-1/2 gap-1.5">
                {slides.map((_, i) => (
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
            )}
          </>
        )}
      </div>

      {slides.length > 1 && (
        <div className="mt-2.5 flex gap-2 overflow-x-auto">
          {slides.map((slide, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              aria-label={slide.kind === "video" ? t("videoSlide") : t("viewImageN", { n: i + 1 })}
              className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 transition ${
                i === index ? "border-accent-signal" : "border-transparent opacity-70 hover:opacity-100"
              }`}
            >
              {slide.kind === "video" ? (
                <>
                  {slide.embed.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={slide.embed.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="block h-full w-full bg-text-primary" />
                  )}
                  {/* 動画であることが一目で分かるよう、再生マークを重ねる */}
                  <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                      <path d="M8 5.5v13l11-6.5-11-6.5Z" />
                    </svg>
                  </span>
                </>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={slide.src} alt="" className="h-full w-full object-cover" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
