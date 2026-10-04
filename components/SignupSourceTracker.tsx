"use client";

import { useEffect } from "react";
import { reportSignupSource } from "@/app/actions/signup-source";
import {
  SIGNUP_SOURCE_KEY,
  SIGNUP_SOURCE_TTL_MS,
  WELCOME_PARAM,
  sourceFromUrlAndReferrer,
} from "@/lib/signup-source";

/**
 * 新規登録の流入元を数えるための、画面に何も表示しない部品（app/layout.tsx に1つだけ置く）。
 *
 * - サイトに来たとき: 流入元がわかれば、最初の1回だけ localStorage に覚える（30日）
 * - 登録直後（URL に ?welcome=1）: 覚えていた流入元をサーバーに送り、URL から welcome を消す
 *
 * 毎回のページ表示でサーバーに問い合わせることはしない（登録直後の1回だけ）。
 */
export default function SignupSourceTracker() {
  useEffect(() => {
    let stored: { s: string; at: number } | null = null;
    try {
      const raw = window.localStorage.getItem(SIGNUP_SOURCE_KEY);
      if (raw) stored = JSON.parse(raw);
      if (stored && Date.now() - stored.at > SIGNUP_SOURCE_TTL_MS) stored = null;
      if (!stored) {
        const s = sourceFromUrlAndReferrer(window.location.href, document.referrer);
        if (s) {
          stored = { s, at: Date.now() };
          window.localStorage.setItem(SIGNUP_SOURCE_KEY, JSON.stringify(stored));
        }
      }
    } catch {
      // localStorage が使えない環境（プライベートモード等）では、流入元は「direct」として数える
    }

    const url = new URL(window.location.href);
    if (url.searchParams.get(WELCOME_PARAM) !== "1") return;
    url.searchParams.delete(WELCOME_PARAM);
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    reportSignupSource(stored?.s ?? null)
      .then((r) => {
        if (r.ok) {
          try {
            window.localStorage.removeItem(SIGNUP_SOURCE_KEY);
          } catch {}
        }
      })
      .catch(() => {});
  }, []);
  return null;
}
