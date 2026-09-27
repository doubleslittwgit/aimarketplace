import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { withSentryConfig } from "@sentry/nextjs/config";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  /* config options here */

  // Server Actionsのボディ上限。
  //
  // 【重要】ファイル本体はServer Actionを経由しない。
  // Vercelのサーバー関数には「1リクエスト4.5MB」という、プランや設定では
  // 回避できないプラットフォーム側の絶対的な上限があり、ここでいくら大きな値を
  // 指定してもそれを超えることはできない（以前320MBを指定していたが、21MBの
  // ファイルを出品した時点で接続を切られ、ブラウザ側では「ページが読み込めない」
  // というクラッシュのような表示になっていた）。
  //
  // そのため、ファイルはブラウザからSupabase Storageへ直接アップロードし
  // （lib/direct-upload.ts）、Server Actionにはその保存先パスだけを渡す方式に
  // 変更した。ここで扱うのはテキストの入力項目だけなので、大きな値は不要。
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

const config = withNextIntl(nextConfig);

// エラー監視（Sentry）。エラーの送信自体は instrumentation*.ts だけで動く。
// ここでは、ビルド時にソースマップ（圧縮前のコードとの対応表）を Sentry へ送り、
// エラーの場所を元のファイル名・行番号で読めるようにする。
// SENTRY_AUTH_TOKEN が設定されているときだけ有効にする（未設定ならビルドは今までどおり）。
export default process.env.SENTRY_AUTH_TOKEN
  ? withSentryConfig(config, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      silent: true,
      telemetry: false,
      // 速度計測は使わないため、ビルド時の自動計測の組み込みは行わない
      buildTimeInstrumentation: false,
      // ソースマップは Sentry へ送った後に削除し、サイトからは配信しない
      sourcemaps: { deleteSourcemapsAfterUpload: true },
      suppressOnRouterTransitionStartWarning: true,
    })
  : config;
