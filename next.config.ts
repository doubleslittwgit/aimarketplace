import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

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

export default withNextIntl(nextConfig);
