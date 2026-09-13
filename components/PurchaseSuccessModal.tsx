"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

const CONFETTI_COLORS = [
  "var(--accent-signal)",
  "var(--accent-ai)",
  "var(--accent-success)",
  "#ffd166",
];

/**
 * 紙吹雪1枚分。位置・色・落下時間をランダムに振って、
 * 見た目が単調にならないようにする。
 */
type ConfettiPiece = {
  id: number;
  left: number; // vw
  delay: number; // s
  duration: number; // s
  color: string;
  rotate: number; // deg
};

function makeConfetti(count: number): ConfettiPiece[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.4,
    duration: 1.8 + Math.random() * 1.2,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    rotate: Math.random() * 360,
  }));
}

export default function PurchaseSuccessModal() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // 初回レンダリング時に一度だけ判定する(遅延初期化)。
  // useEffect + setState だとカスケードレンダリングになるため避ける。
  const [open, setOpen] = useState(() => searchParams.get("purchased") === "1");
  const [confetti] = useState<ConfettiPiece[]>(() =>
    searchParams.get("purchased") === "1" ? makeConfetti(60) : []
  );

  function close() {
    setOpen(false);
    // ?purchased=1 を消しておく。消さないとリロード時にまた表示されてしまう。
    router.replace(pathname);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-text-primary/40 px-4">
      {/* 紙吹雪 */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        {confetti.map((c) => (
          <span
            key={c.id}
            className="absolute top-[-12px] h-2.5 w-1.5 rounded-[1px]"
            style={{
              left: `${c.left}vw`,
              backgroundColor: c.color,
              animation: `confetti-fall ${c.duration}s ease-in ${c.delay}s forwards`,
              transform: `rotate(${c.rotate}deg)`,
            }}
          />
        ))}
      </div>

      <div className="relative w-full max-w-sm rounded-2xl border border-border bg-bg p-7 text-center shadow-xl">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent-success/10">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--accent-success)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>

        <h2 className="mb-2 font-display text-lg font-semibold text-text-primary">
          ご購入ありがとうございます
        </h2>
        <p className="mb-6 text-[13px] leading-relaxed text-text-muted">
          マイページからいつでもダウンロードできます。
        </p>

        <div className="flex flex-col gap-2">
          <Link
            href="/dashboard"
            className="w-full rounded-lg bg-accent-signal py-2.5 text-[13px] font-medium text-white transition hover:brightness-105"
          >
            マイページへ
          </Link>
          <button
            type="button"
            onClick={close}
            className="w-full rounded-lg border border-border py-2.5 text-[13px] font-medium text-text-secondary transition hover:bg-surface"
          >
            閉じる
          </button>
        </div>
      </div>

      <style jsx global>{`
        @keyframes confetti-fall {
          from {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          to {
            transform: translateY(100vh) rotate(360deg);
            opacity: 0.2;
          }
        }
      `}</style>
    </div>
  );
}
