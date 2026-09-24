"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useTypingRotator } from "@/lib/use-typing-rotator";

/**
 * ヒーロー見出し。
 *
 * 「あなたの[アイデア]が」は固定文言（[アイデア]の部分だけ色が変わる）、
 * その下の行だけが、複数の言い回しをタイプ→消す、を繰り返す。
 *
 * 色の演出：
 * - 下の行が空っぽ（次の言葉をタイプする直前）の間だけ、「アイデア」が
 *   オレンジ色になる。しかも上から下へ塗りつぶされるように変化する
 *   （＝このオレンジが、下の言葉を生み出しているという見立て）。
 * - 下の行の文字が現れ始めると同時に、「アイデア」は上から下へ
 *   元の紺色に戻っていく（塗りつぶしと同じ方向で、今度は消えていく）。
 */
export default function HeroHeading() {
  const t = useTranslations("home");
  const repertoire = t.raw("heroRepertoire") as string[];
  const { displayed, isEmpty } = useTypingRotator(repertoire, {
    typingSpeedMs: 60,
    deletingSpeedMs: 32,
    pauseMs: 2600,
    gapMs: 450,
  });

  return (
    <h1 className="relative isolate mt-8 font-display text-3xl font-semibold leading-[1.1] tracking-tight text-text-primary [text-shadow:0_0_20px_rgba(255,255,255,0.95),0_0_36px_rgba(255,255,255,0.85)] sm:text-[4rem] sm:[text-shadow:none] md:text-[4.5rem]">
      {/* スマホでは背後の商品カードと重なるため、見出しの形に沿った白いマスクを敷く（トップページのロゴ・説明文と同じ） */}
      <span aria-hidden className="pointer-events-none absolute rounded-3xl bg-bg shadow-[0_0_14px_10px_var(--bg)] sm:hidden -inset-x-2 -inset-y-1 -z-10" />
      {t("heroPrefix")}
      <HighlightWord text={t("heroHighlight")} active={isEmpty} />
      {t("heroConnector")}
      <br />
      <FitOneLine text={displayed} />
    </h1>
  );
}

/**
 * 下の句を、どれだけ長い言い回しが来ても改行させず、必ず1行に収める。
 * 入りきらない場合は、文字を縮小して幅に合わせる（縦横比は保ったまま縮小するので
 * 潰れて見えることはない）。
 */
function FitOneLine({ text }: { text: string }) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const textEl = textRef.current;
    if (!container || !textEl) return;

    textEl.style.transform = "scale(1)";
    const containerWidth = container.clientWidth;
    const textWidth = textEl.scrollWidth;
    if (containerWidth > 0 && textWidth > containerWidth) {
      setScale(containerWidth / textWidth);
    } else {
      setScale(1);
    }
  }, [text]);

  return (
    <span ref={containerRef} className="block w-full overflow-hidden text-accent-signal">
      <span
        ref={textRef}
        className="inline-block origin-left whitespace-nowrap"
        style={{ transform: `scale(${scale})` }}
      >
        {text}
      </span>
    </span>
  );
}

type ClipState = "hidden" | "revealed" | "hiding";

function HighlightWord({ text, active }: { text: string; active: boolean }) {
  const [clip, setClip] = useState<ClipState>("hidden");

  useEffect(() => {
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    if (active) {
      // このタイミングでは、前回のサイクルの「hiding→hidden」遷移（520ms後）は
      // 既に完了している（タイプ・消去・待機の1サイクルはそれよりずっと長い）ため、
      // 現在のclipは既にhidden。そこからrevealedへ遷移させれば、必ず
      // 「上→下」に塗りつぶす向きになる。
      timeouts.push(setTimeout(() => setClip("revealed"), 20));
    } else {
      // revealed(下端0%)→hiding(上端100%)の遷移中、常に可視領域が0%のまま
      // 推移するため、見た目は「上から下へ消えていく」ワイプになる。
      timeouts.push(setTimeout(() => setClip("hiding"), 0));
      timeouts.push(setTimeout(() => setClip("hidden"), 520));
    }
    return () => timeouts.forEach(clearTimeout);
  }, [active]);

  const clipPath =
    clip === "hidden"
      ? "inset(0 0 100% 0)"
      : clip === "revealed"
        ? "inset(0 0 0% 0)"
        : "inset(100% 0 0% 0)";

  return (
    <span className="relative inline-block">
      <span className="text-text-primary">{text}</span>
      <span
        aria-hidden
        className="absolute inset-0 text-accent-signal transition-[clip-path] duration-500 ease-in-out"
        style={{ clipPath }}
      >
        {text}
      </span>
    </span>
  );
}
