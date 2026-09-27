// ブラウザ側のエラー監視（Sentry）。設定の中身は lib/sentry-options.ts を参照。
import * as Sentry from "@sentry/nextjs";
import { sentryBaseOptions, scrubEvent } from "@/lib/sentry-options";

Sentry.init({
  ...sentryBaseOptions,
  // 拡張機能やネットワーク切断など、BuildBay側で直せないよくあるエラーは送らない
  ignoreErrors: [
    "ResizeObserver loop limit exceeded",
    "ResizeObserver loop completed with undelivered notifications",
    "Non-Error promise rejection captured",
    /^Failed to fetch$/,
    /^Load failed$/,
    /^NetworkError when attempting to fetch resource\.?$/,
  ],
  denyUrls: [/^chrome-extension:\/\//, /^moz-extension:\/\//, /^safari-web-extension:\/\//],
  beforeSend: (event) => scrubEvent(event),
});
