"use client";

import { useState } from "react";
import Link from "next/link";

/**
 * Academy の「お祝い」演出（中央のメッセージ＋紙吹雪）。
 * ツールの出品・購入時の演出（SubmitSuccessModal / PurchaseSuccessModal）と同じ形で、
 * 紙吹雪だけ Academy の緑と金にしている。
 * 表示するかどうかは呼び出し側が open で決める。
 */
const COLORS = ["#173F35", "#2f7a5b", "#8fb89a", "#C9A227", "#e8c65a", "#f0d77a"];

type Piece = { id: number; left: number; delay: number; duration: number; color: string; rotate: number; wide: boolean };

function makeConfetti(count: number): Piece[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.5,
    duration: 1.8 + Math.random() * 1.4,
    color: COLORS[i % COLORS.length],
    rotate: Math.random() * 360,
    wide: Math.random() > 0.5,
  }));
}

export default function AcademyCelebration({
  title,
  body,
  primary,
  secondary,
  onClose,
}: {
  title: string;
  body: string;
  /** 主ボタン。href を渡すとリンク、渡さないと閉じるボタンになる */
  primary: { label: string; href?: string };
  secondary?: { label: string; href?: string };
  onClose: () => void;
}) {
  // 紙吹雪の位置は表示した瞬間に一度だけ決める（再描画のたびに動かないように）
  const [confetti] = useState(() => makeConfetti(70));

  const button = (b: { label: string; href?: string }, main: boolean) => {
    const cls = main
      ? "w-full rounded-lg bg-gradient-to-r from-[#173F35] via-[#2f7a5b] to-[#C9A227] py-2.5 text-[13px] font-medium text-white transition hover:brightness-110"
      : "w-full rounded-lg border border-border py-2.5 text-[13px] font-medium text-text-secondary transition hover:bg-surface";
    return b.href ? (
      <Link href={b.href} className={cls}>
        {b.label}
      </Link>
    ) : (
      <button type="button" onClick={onClose} className={cls}>
        {b.label}
      </button>
    );
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-text-primary/40 px-4" role="dialog" aria-modal="true">
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        {confetti.map((c) => (
          <span
            key={c.id}
            className={`absolute top-[-14px] rounded-[1px] ${c.wide ? "h-2 w-3" : "h-3 w-1.5"}`}
            style={{
              left: `${c.left}vw`,
              backgroundColor: c.color,
              transform: `rotate(${c.rotate}deg)`,
              animation: `ac-confetti-fall ${c.duration}s ease-in ${c.delay}s forwards`,
            }}
          />
        ))}
      </div>

      <div className="relative w-full max-w-sm rounded-2xl border border-border bg-bg p-7 text-center shadow-xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/academy-logo.png" alt="BuildBay Academy" width={1400} height={182} className="mx-auto mb-5 h-4 w-auto" />
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#C9A227]/15">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9C7A12" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>
        <h2 className="mb-2 font-display text-lg font-semibold text-text-primary">{title}</h2>
        <p className="mb-6 text-[13px] leading-relaxed text-text-muted">{body}</p>
        <div className="flex flex-col gap-2">
          {button(primary, true)}
          {secondary && button(secondary, false)}
        </div>
      </div>
    </div>
  );
}
