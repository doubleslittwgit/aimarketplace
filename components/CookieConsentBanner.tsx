"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const STORAGE_KEY = "buildbay-cookie-notice-ack";

/**
 * Cookie利用の告知バナー。
 *
 * 本サービスが使うCookieはログイン状態の維持に必須のものだけで、
 * 広告目的の任意トラッキングは行っていない（プライバシーポリシー参照）。
 * そのため「同意する/しない」の選択式ではなく、
 * 「使っていることをお知らせし、確認いただく」という告知形式にしている。
 */
export default function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  // localStorageはブラウザにしか無いため、サーバー側のレンダリングでは
  // 確認できない。ここで確認して初めて表示を決めるのは意図的な設計で
  // （サーバーとクライアントの初回描画を一致させ、hydrationのズレを防ぐため）、
  // 単純な派生値の計算に置き換えられるものではない。
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      if (!window.localStorage.getItem(STORAGE_KEY)) {
        setVisible(true);
      }
    } catch {
      // localStorageが使えない環境（プライベートモード等）では、
      // 毎回表示されてしまうが、機能自体は壊さない
      setVisible(true);
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  function acknowledge() {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // 保存できなくても閉じる操作自体は成立させる
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-bg/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 px-6 py-4 text-[13px] text-text-secondary sm:flex-row sm:justify-between">
        <p className="leading-relaxed">
          本サービスは、ログイン状態を維持するために必要なCookieを使用しています。
          詳しくは
          <Link href="/legal/privacy" className="text-accent-ai underline underline-offset-2">
            プライバシーポリシー
          </Link>
          をご覧ください。
        </p>
        <button
          type="button"
          onClick={acknowledge}
          className="shrink-0 rounded-lg bg-accent-signal px-4 py-2 text-[13px] font-medium text-white transition hover:brightness-105"
        >
          確認しました
        </button>
      </div>
    </div>
  );
}
