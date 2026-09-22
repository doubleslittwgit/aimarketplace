"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

const CONFETTI_COLORS = [
  "var(--accent-signal)",
  "var(--accent-ai)",
  "var(--accent-success)",
  "#ffd166",
];

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

/**
 * 出品完了時のお祝い演出。PurchaseSuccessModal（購入完了）と同じ
 * 紙吹雪の仕組みを流用している。/dashboard?pending=1 で表示される。
 */
export default function SubmitSuccessModal() {
  const t = useTranslations("dashboard.submitSuccessModal");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [open, setOpen] = useState(() => searchParams.get("pending") === "1");
  const [confetti] = useState<ConfettiPiece[]>(() =>
    searchParams.get("pending") === "1" ? makeConfetti(70) : []
  );

  function close() {
    setOpen(false);
    // ?pending=1 を消しておく。消さないとリロード時にまた表示されてしまう。
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
              animation: `submit-confetti-fall ${c.duration}s ease-in ${c.delay}s forwards`,
              transform: `rotate(${c.rotate}deg)`,
            }}
          />
        ))}
      </div>

      <div className="relative w-full max-w-sm rounded-2xl border border-border bg-bg p-7 text-center shadow-xl">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent-signal/10">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--accent-signal)"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 16V4M12 4 7 9M12 4l5 5" />
            <path d="M20 16.5v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2" />
          </svg>
        </div>

        <h2 className="mb-2 font-display text-2xl font-bold text-text-primary">
          {t("title")}
        </h2>
        <p className="mb-6 text-[13px] leading-relaxed text-text-muted">
          {t("body")}
        </p>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={close}
            className="w-full rounded-lg bg-accent-signal py-2.5 text-[13px] font-medium text-white transition hover:brightness-105"
          >
            {t("close")}
          </button>
          <Link
            href="/submit"
            className="w-full rounded-lg border border-border py-2.5 text-[13px] font-medium text-text-secondary transition hover:bg-surface"
          >
            {t("submitAnother")}
          </Link>
        </div>
      </div>

      <style jsx global>{`
        @keyframes submit-confetti-fall {
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
