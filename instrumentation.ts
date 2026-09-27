import * as Sentry from "@sentry/nextjs";

/**
 * サーバー起動時に一度だけ呼ばれる（Next.js の instrumentation）。
 * エラー監視（Sentry）を、実行環境（Node.js / Edge）に合わせて初期化する。
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// サーバーコンポーネント・Route Handler・Server Action で起きたエラーを Sentry に送る
export const onRequestError = Sentry.captureRequestError;
