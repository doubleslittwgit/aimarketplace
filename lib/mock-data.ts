export type Tool = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  category: string;
  categories: string[];
  price: number; // 0 = free
  version: string;
  installs: number;
  likes: number;
  views: number;
  author: {
    name: string;
    handle: string;
  };
  tags: string[];
  updatedAt: string; // ISO date
  runtime: "cloud" | "local";
  /** インターネット接続の要否（未設定の古い出品は null） */
  internetAccess?: "required" | "partial" | "offline" | null;
  /** 対応言語（lib/tool-languages.ts のコード。未設定の古い出品は空） */
  uiLanguages?: string[];
  thumbnailUrl?: string | null;
  galleryUrls?: string[];
  fileSizeBytes?: number | null;
  /** 期間限定のセール価格（任意）。lib/sale-price.tsで実効価格を計算する */
  salePrice?: number | null;
  saleEndsAt?: string | null;
  /** 改造・再配布を許可しているか */
  remixAllowed?: boolean;
  /** 返金対応の方針 */
  refundPolicy?: "none" | "conditional" | "full";
  /** 完成前の「開発中」として公開しているか */
  isWip?: boolean;
  /** 紹介動画のURL（YouTube/Vimeoのみ） */
  videoUrl?: string | null;
  /** 対応ソフト（BuildBay Creativeのプラグインの場合） */
  hostApps?: string[];
};

// 出品フォームの上限（サーバー側 app/submit/actions.ts のチェックと必ず揃えること）
export const MAX_TOOL_FILE_SIZE = 300 * 1024 * 1024; // 300MB
export const MAX_THUMBNAIL_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function formatFileSize(bytes: number | null | undefined) {
  if (bytes === null || bytes === undefined || bytes <= 0) return null;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const categories = [
  "自動化・ワークフロー",
  "開発者ツール",
  "データ分析",
  "AI・チャットボット",
  "クリエイティブ",
  "動画・画像編集",
  "写真",
  "デザイン",
  "文章・ライティング",
  "音楽・オーディオ",
  "マーケティング",
  "SNS・コミュニティ",
  "eコマース・物販",
  "ビジネス・生産性",
  "金融・家計管理",
  "教育・学習",
  "翻訳・言語学習",
  "ゲーム",
  "ライフスタイル",
  "健康・フィットネス",
  "料理・レシピ",
  "旅行",
  "子育て・育児",
  "ペット",
  "ユーティリティ",
  "その他",
] as const;

export function formatPrice(price: number, freeLabel = "無料") {
  return price === 0 ? freeLabel : `¥${price.toLocaleString()}`;
}

export function formatInstalls(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}
