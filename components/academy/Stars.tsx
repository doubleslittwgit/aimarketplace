"use client";

import { useState } from "react";

const STAR = "m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2Z";
const GOLD = "#C9A227";

/**
 * Academy用の星（金色）。onChange を渡すと、押して評価を選べる入力になる。
 * 表示だけのときは、平均点に合わせて最後の星を途中まで塗る（例: 4.3 → 4つと3割）。
 */
export default function Stars({
  value,
  onChange,
  size = 14,
  label,
}: {
  value: number;
  onChange?: (v: number) => void;
  size?: number;
  /** 読み上げ用のラベル（例: 「5点中4.3」） */
  label?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const interactive = Boolean(onChange);
  const shown = hover ?? value;

  return (
    <span
      className="inline-flex items-center gap-0.5"
      role={interactive ? "radiogroup" : "img"}
      aria-label={label}
    >
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.max(0, Math.min(1, shown - (i - 1)));
        const star = (
          <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
            <defs>
              <clipPath id={`star-clip-${i}-${Math.round(fill * 100)}`}>
                <rect x="0" y="0" width={24 * fill} height="24" />
              </clipPath>
            </defs>
            <path d={STAR} fill="none" stroke={fill > 0 ? GOLD : "var(--text-dim)"} strokeWidth="1.5" />
            {fill > 0 && (
              <path d={STAR} fill={GOLD} clipPath={`url(#star-clip-${i}-${Math.round(fill * 100)})`} />
            )}
          </svg>
        );
        if (!interactive) return <span key={i}>{star}</span>;
        return (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={value === i}
            aria-label={`${i}`}
            onClick={() => onChange?.(i)}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            className="cursor-pointer p-0.5"
          >
            {star}
          </button>
        );
      })}
    </span>
  );
}
