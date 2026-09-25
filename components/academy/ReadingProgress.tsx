"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

/** 本文の要素（講座ページで id="course-body" を付けている） */
const BODY_ID = "course-body";
/** 見出しへ移動したとき、上部のヘッダーに隠れないよう空ける余白 */
const SCROLL_OFFSET = 88;
/** スクロールが止まってから保存するまでの時間 */
const SAVE_DELAY_MS = 2500;

export type SavedProgress = { headingIndex: number; percent: number; maxPercent: number };

/**
 * 講座の「読んだ位置」を記録し、次に開いたときに続きから読めるようにする。
 *
 * - 画面上部に、本文をどこまで読んだかの細いバーを出す（誰にでも表示）
 * - ログインしていて全文を読める人は、位置をデータベースに保存する（本人しか読めない表）
 * - 前回の位置があれば、画面下に「続きから読む」を出す
 * - 本文の見出しに ch-0, ch-1 … のIDを付け、目次から飛べるようにする
 */
export default function ReadingProgress({
  courseId,
  userId,
  trackable,
  initial,
  headingTexts,
}: {
  courseId: string;
  /** ログインしていなければ null（保存しない） */
  userId: string | null;
  /** 位置を保存するか（全文を読める購入者・無料講座の読者。作者・管理者は保存しない） */
  trackable: boolean;
  initial: SavedProgress | null;
  /** 目次の見出し文字列（「◯◯の続きから」の表示用） */
  headingTexts: string[];
}) {
  const t = useTranslations("academyCourse.progress");
  const [percent, setPercent] = useState(0);
  const [showResume, setShowResume] = useState(
    Boolean(initial && initial.percent >= 3 && initial.percent < 97)
  );
  const headingsRef = useRef<HTMLElement[]>([]);
  const lastSavedRef = useRef<{ headingIndex: number; percent: number } | null>(
    initial ? { headingIndex: initial.headingIndex, percent: initial.percent } : null
  );
  const maxRef = useRef(initial?.maxPercent ?? 0);
  const currentRef = useRef<{ headingIndex: number; percent: number }>({ headingIndex: -1, percent: 0 });

  // 見出しにIDを付ける（サーバーで作ったHTMLには付いていないため、表示後に付ける）
  useEffect(() => {
    const body = document.getElementById(BODY_ID);
    if (!body) return;
    const hs = Array.from(body.querySelectorAll<HTMLElement>("h2, h3")).filter(
      (h) => (h.textContent ?? "").trim().length > 0
    );
    hs.forEach((h, i) => {
      h.id = `ch-${i}`;
      h.style.scrollMarginTop = `${SCROLL_OFFSET}px`;
    });
    headingsRef.current = hs;
    // URLに #ch-3 などが付いて開かれた場合、IDを付けた後で改めてその位置へ移動する
    if (window.location.hash.startsWith("#ch-")) {
      document.getElementById(window.location.hash.slice(1))?.scrollIntoView();
    }
  }, []);

  // スクロール位置から「何%読んだか」「今どの見出しにいるか」を求め、止まったら保存する
  useEffect(() => {
    const body = document.getElementById(BODY_ID);
    if (!body) return;
    const supabase = trackable && userId ? createClient() : null;
    let timer: number | undefined;

    const save = () => {
      if (!supabase || !userId) return;
      const cur = currentRef.current;
      const last = lastSavedRef.current;
      if (last && last.headingIndex === cur.headingIndex && Math.abs(last.percent - cur.percent) < 2) return;
      maxRef.current = Math.max(maxRef.current, cur.percent);
      lastSavedRef.current = { ...cur };
      void supabase.from("course_progress").upsert(
        {
          user_id: userId,
          course_id: courseId,
          heading_index: cur.headingIndex,
          percent: cur.percent,
          max_percent: maxRef.current,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,course_id" }
      );
    };

    const measure = () => {
      const rect = body.getBoundingClientRect();
      // 画面の上から3割の位置を「今読んでいるところ」とみなす
      const readLine = window.innerHeight * 0.3;
      const p = rect.height > 0 ? ((readLine - rect.top) / rect.height) * 100 : 0;
      // 本文の最後が画面に入ったら読み終わり（100%）とする
      const reachedEnd = rect.bottom <= window.innerHeight;
      const pct = reachedEnd ? 100 : Math.max(0, Math.min(100, Math.round(p)));
      let idx = -1;
      headingsRef.current.forEach((h, i) => {
        if (h.getBoundingClientRect().top <= SCROLL_OFFSET + 8) idx = i;
      });
      currentRef.current = { headingIndex: idx, percent: pct };
      setPercent(pct);
      if (initial && pct >= initial.percent - 1) setShowResume(false);
      window.clearTimeout(timer);
      timer = window.setTimeout(save, SAVE_DELAY_MS);
    };

    const onHide = () => {
      if (document.visibilityState === "hidden") save();
    };

    measure();
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", save);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", save);
    };
  }, [courseId, userId, trackable, initial]);

  function resume() {
    if (!initial) return;
    setShowResume(false);
    const target = initial.headingIndex >= 0 ? headingsRef.current[initial.headingIndex] : null;
    if (target) {
      target.scrollIntoView({ behavior: "smooth" });
      return;
    }
    const body = document.getElementById(BODY_ID);
    if (!body) return;
    const top = body.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({
      top: top + (body.offsetHeight * initial.percent) / 100 - window.innerHeight * 0.3,
      behavior: "smooth",
    });
  }

  const resumeHeading =
    initial && initial.headingIndex >= 0 ? headingTexts[initial.headingIndex] ?? null : null;

  return (
    <>
      {/* 読んだ量のバー（ヘッダーのすぐ上、画面の最上部に固定） */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px] bg-transparent" aria-hidden>
        <div
          className="h-full bg-[#C9A227] transition-[width] duration-150"
          style={{ width: `${percent}%` }}
        />
      </div>

      {showResume && initial && (
        <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
          <div className="flex max-w-lg items-center gap-3 rounded-full border border-[#C9A227]/40 bg-bg/95 py-2 pl-4 pr-2 shadow-[0_10px_30px_-10px_rgba(23,63,53,0.45)] backdrop-blur">
            <p className="min-w-0 flex-1 truncate text-[12px] text-text-secondary">
              {resumeHeading
                ? t("resumeFrom", { heading: resumeHeading })
                : t("resumeAt", { percent: initial.percent })}
            </p>
            <button
              type="button"
              onClick={resume}
              className="shrink-0 rounded-full bg-[#173F35] px-3.5 py-1.5 text-[12px] font-semibold text-[#F7F3E8] transition hover:brightness-110"
            >
              {t("resume")}
            </button>
            <button
              type="button"
              onClick={() => setShowResume(false)}
              aria-label={t("dismiss")}
              className="shrink-0 px-1.5 text-[16px] leading-none text-text-dim hover:text-text-primary"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </>
  );
}
