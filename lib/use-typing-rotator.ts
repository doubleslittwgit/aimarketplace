"use client";

import { useEffect, useState } from "react";

export type TypingRotatorOptions = {
  /** 1文字タイプするのにかける時間(ms) */
  typingSpeedMs?: number;
  /** 1文字消すのにかける時間(ms) */
  deletingSpeedMs?: number;
  /** 全部タイプし終えてから、消し始めるまでの待ち時間(ms) */
  pauseMs?: number;
  /** 全部消し終えてから、次の候補をタイプし始めるまでの間(ms) */
  gapMs?: number;
};

/**
 * 候補の配列を「1文字ずつタイプ→少し待つ→1文字ずつ消す→次の候補」で
 * 延々とループさせる。検索欄のプレースホルダーや、ヒーロー見出しの
 * 入れ替わる部分など、複数箇所で使い回す想定の共通フック。
 *
 * isEmpty: 現在何も表示されていない瞬間（＝消し終えて、次をタイプし
 * 始める直前）かどうか。ヒーロー見出し側で「文字が無い間だけ色を変える」
 * 演出のトリガーに使う。
 */
export function useTypingRotator(
  phrases: string[],
  {
    typingSpeedMs = 55,
    deletingSpeedMs = 28,
    pauseMs = 2400,
    gapMs = 500,
  }: TypingRotatorOptions = {}
) {
  const [index, setIndex] = useState(0);
  const [displayed, setDisplayed] = useState("");
  const [phase, setPhase] = useState<"typing" | "deleting">("typing");

  useEffect(() => {
    if (phrases.length === 0) return;
    const current = phrases[index % phrases.length];
    let timeout: ReturnType<typeof setTimeout>;

    if (phase === "typing") {
      if (displayed.length < current.length) {
        timeout = setTimeout(
          () => setDisplayed(current.slice(0, displayed.length + 1)),
          typingSpeedMs
        );
      } else {
        timeout = setTimeout(() => setPhase("deleting"), pauseMs);
      }
    } else {
      if (displayed.length > 0) {
        timeout = setTimeout(
          () => setDisplayed(current.slice(0, displayed.length - 1)),
          deletingSpeedMs
        );
      } else {
        timeout = setTimeout(() => {
          setIndex((i) => (i + 1) % phrases.length);
          setPhase("typing");
        }, gapMs);
      }
    }

    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayed, phase, index, phrases.join("|")]);

  return { displayed, isEmpty: displayed.length === 0 };
}
