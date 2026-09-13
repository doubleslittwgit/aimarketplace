import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */

  // Server Actions（出品フォームの送信など）のデフォルトのボディ上限は1MB。
  // 出品フォームは「ZIP最大300MBまで」と明記しているため、それに合わせて引き上げる。
  // （実ファイルはSupabase Storageへ直接アップロードされるが、
  //   フォームの送信自体はServer Action経由でサーバーを一度通るため、この設定が必要）
  experimental: {
    serverActions: {
      // ZIP最大300MB + サムネイル最大10MB + multipartのオーバーヘッド分の余裕
      bodySizeLimit: "320mb",
    },
  },
};

export default nextConfig;
