/**
 * エラー監視（Sentry）の共通設定。
 *
 * - DSN（NEXT_PUBLIC_SENTRY_DSN）が未設定なら何も送らない（ローカル開発・設定前の本番でも安全）
 * - 送るのは「エラー」だけ。操作の録画（Session Replay）や速度計測は使わない
 * - 個人情報は送らない: IPアドレス・Cookie・認証ヘッダー・メールアドレスは送信前に取り除く
 *
 * 使っている場所: instrumentation-client.ts（ブラウザ）/ sentry.server.config.ts / sentry.edge.config.ts
 */

import type { ErrorEvent } from "@sentry/nextjs";

const SENSITIVE_HEADERS = ["cookie", "authorization", "x-forwarded-for", "x-real-ip", "stripe-signature"];

/** 送信前に個人情報を取り除く */
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  if (event.user) {
    // ユーザーを区別するためのID以外（メール・IPなど）は送らない
    const id = event.user.id;
    event.user = id !== undefined ? { id } : undefined;
  }
  if (event.request) {
    delete event.request.cookies;
    if (event.request.headers) {
      for (const key of Object.keys(event.request.headers)) {
        if (SENSITIVE_HEADERS.includes(key.toLowerCase())) delete event.request.headers[key];
      }
    }
  }
  return event;
}

export const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN || undefined;

export const sentryBaseOptions = {
  dsn: sentryDsn,
  enabled: Boolean(sentryDsn),
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.VERCEL_ENV || process.env.NODE_ENV,
  sendDefaultPii: false,
  // 速度計測は使わない（無料枠をエラーのために残す）
  tracesSampleRate: 0,
};
