// サーバー側（Node.js）のエラー監視（Sentry）。instrumentation.ts から読み込む。
import * as Sentry from "@sentry/nextjs";
import { sentryBaseOptions, scrubEvent } from "@/lib/sentry-options";

Sentry.init({
  ...sentryBaseOptions,
  beforeSend: (event) => scrubEvent(event),
});
