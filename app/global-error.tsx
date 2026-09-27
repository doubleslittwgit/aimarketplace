"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

/**
 * ルートのレイアウト自体でエラーが起きたときの画面（めったに出ない）。
 * レイアウト・スタイル・翻訳がすべて読み込めない状態で表示されるため、見た目は最小限にして
 * 日本語・中国語・英語を並べて出す。エラーの内容は Sentry に送る。
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="ja">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f5fafd",
          color: "#16232d",
          fontFamily: "'Hiragino Sans','Yu Gothic','Microsoft JhengHei',sans-serif",
          padding: "24px",
        }}
      >
        <title>BuildBay</title>
        <div style={{ maxWidth: 440, textAlign: "center" }}>
          <p style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>BuildBay</p>
          <h1 style={{ fontSize: 20, margin: "20px 0 8px" }}>問題が発生しました</h1>
          <p style={{ fontSize: 14, lineHeight: 1.8, color: "#4a5b64", margin: 0 }}>
            ページを表示できませんでした。時間をおいてもう一度お試しください。
            <br />
            發生問題，請稍後再試。 / Something went wrong. Please try again.
          </p>
          <div style={{ marginTop: 24, display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => retry()}
              style={{
                background: "#ff6b4a",
                color: "#fff",
                border: "none",
                borderRadius: 999,
                padding: "10px 22px",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              もう一度読み込む
            </button>
            {/* ルートのレイアウトが壊れているため、Link ではなく通常のリンクで全体を読み直す */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              style={{
                border: "1px solid #d5e2e8",
                borderRadius: 999,
                padding: "10px 22px",
                fontSize: 14,
                color: "#16232d",
                textDecoration: "none",
              }}
            >
              トップへ
            </a>
          </div>
          {error.digest && (
            <p style={{ marginTop: 20, fontSize: 11, color: "#9aa8b0", fontFamily: "monospace" }}>
              ID: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
