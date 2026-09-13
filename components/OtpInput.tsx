"use client";

import { useRef } from "react";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
  length?: number;
};

export default function OtpInput({
  value,
  onChange,
  onComplete,
  disabled,
  length = 6,
}: Props) {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? "");

  function setDigit(index: number, digit: string) {
    const next = digits.slice();
    next[index] = digit;
    const joined = next.join("");
    onChange(joined);
    if (joined.length === length) onComplete?.(joined);
  }

  function handleChange(index: number, raw: string) {
    const cleaned = raw.replace(/\D/g, "");
    if (!cleaned) {
      setDigit(index, "");
      return;
    }
    // 複数文字が一度に入ってきた場合（IME補完・貼り付け等）は、そこから順に埋める
    if (cleaned.length > 1) {
      const next = digits.slice();
      for (let i = 0; i < cleaned.length && index + i < length; i++) {
        next[index + i] = cleaned[i];
      }
      const joined = next.join("");
      onChange(joined);
      const nextEmpty = Math.min(index + cleaned.length, length - 1);
      inputsRef.current[nextEmpty]?.focus();
      if (joined.length === length) onComplete?.(joined);
      return;
    }
    setDigit(index, cleaned);
    if (index < length - 1) inputsRef.current[index + 1]?.focus();
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
    if (e.key === "ArrowLeft" && index > 0) inputsRef.current[index - 1]?.focus();
    if (e.key === "ArrowRight" && index < length - 1)
      inputsRef.current[index + 1]?.focus();
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!pasted) return;
    onChange(pasted);
    const focusIndex = Math.min(pasted.length, length - 1);
    inputsRef.current[focusIndex]?.focus();
    if (pasted.length === length) onComplete?.(pasted);
  }

  return (
    <div className="flex justify-center gap-2">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            inputsRef.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          autoFocus={i === 0}
          disabled={disabled}
          value={d}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          className="h-12 w-10 rounded-lg border border-border bg-bg text-center font-mono text-xl font-semibold text-text-primary transition focus:border-accent-signal focus:outline-none focus:ring-2 focus:ring-accent-signal/20 disabled:opacity-50 sm:h-14 sm:w-12"
        />
      ))}
    </div>
  );
}
