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
  thumbnailUrl?: string | null;
  galleryUrls?: string[];
  fileSizeBytes?: number | null;
  /** 期間限定のセール価格（任意）。lib/sale-price.tsで実効価格を計算する */
  salePrice?: number | null;
  saleEndsAt?: string | null;
  /** 改造・再配布を許可しているか */
  remixAllowed?: boolean;
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

export const tools: Tool[] = [
  {
    id: "1",
    slug: "invoice-parser-ai",
    name: "InvoiceParser AI",
    tagline: "請求書PDFを3秒でスプレッドシートに変換",
    description:
      "アップロードした請求書PDFをAIが自動解析し、金額・日付・取引先を抽出してCSV/Excelに出力します。経理担当者の月次集計時間を大幅に削減。",
    category: "自動化・ワークフロー",
    categories: ["自動化・ワークフロー"],
    price: 1200,
    version: "2.4.0",
    installs: 842,
    views: 3400,
    likes: 156,
    author: { name: "Kenji Sato", handle: "@kenji_dev" },
    tags: ["PDF", "経理", "OCR"],
    updatedAt: "2026-08-12",
    runtime: "cloud",
  },
  {
    id: "2",
    slug: "scene-cut-detector",
    name: "SceneCut Detector",
    tagline: "動画のカット点を自動検出してタイムラインに書き出す",
    description:
      "長尺動画をアップロードすると、シーンの切り替わりを検出しPremiere Pro / DaVinci Resolve用のマーカーファイルを生成します。",
    category: "動画・画像編集",
    categories: ["動画・画像編集"],
    price: 0,
    version: "1.9.2",
    installs: 3021,
    views: 12500,
    likes: 512,
    author: { name: "Mio Tanaka", handle: "@mio_edits" },
    tags: ["動画編集", "自動化"],
    updatedAt: "2026-08-20",
    runtime: "local",
  },
  {
    id: "3",
    slug: "churn-predictor",
    name: "Churn Predictor Lite",
    tagline: "顧客データからサブスク解約リスクをスコア化",
    description:
      "CSVで顧客の利用ログをアップロードすると、解約しそうな顧客を上位順にランキング表示。営業チームの優先順位付けに。",
    category: "データ分析",
    categories: ["データ分析"],
    price: 2400,
    version: "0.8.1",
    installs: 214,
    views: 980,
    likes: 48,
    author: { name: "Rei Fujimoto", handle: "@rei_analytics" },
    tags: ["機械学習", "SaaS"],
    updatedAt: "2026-07-30",
    runtime: "cloud",
  },
  {
    id: "4",
    slug: "commit-summarizer",
    name: "Commit Summarizer",
    tagline: "1週間分のGitログを日本語の進捗レポートに要約",
    description:
      "リポジトリを接続すると、コミット履歴からその週の作業内容を自然な日本語でまとめたレポートを自動生成します。週報作成が不要に。",
    category: "開発者ツール",
    categories: ["開発者ツール"],
    price: 500,
    version: "3.1.0",
    installs: 1508,
    views: 6200,
    likes: 289,
    author: { name: "Yuto Ishikawa", handle: "@yuto_builds" },
    tags: ["Git", "レポート", "AI要約"],
    updatedAt: "2026-08-25",
    runtime: "cloud",
  },
  {
    id: "5",
    slug: "adcopy-variant-gen",
    name: "AdCopy Variant Generator",
    tagline: "1つの商品説明から広告文を20パターン生成",
    description:
      "商品名と特徴を入力するだけで、Meta広告・Google広告向けのコピーをトーン違いで大量生成。A/Bテストの初動を高速化します。",
    category: "マーケティング",
    categories: ["マーケティング"],
    price: 800,
    version: "1.3.4",
    installs: 967,
    views: 4100,
    likes: 201,
    author: { name: "Nana Kobayashi", handle: "@nana_growth" },
    tags: ["広告", "コピーライティング"],
    updatedAt: "2026-08-05",
    runtime: "cloud",
  },
  {
    id: "6",
    slug: "palette-extractor",
    name: "Palette Extractor Pro",
    tagline: "画像から配色パレットとFigmaトークンを抽出",
    description:
      "参考画像をドラッグ＆ドロップすると、主要カラーを抽出しFigma Variables用のJSONとして書き出します。デザインシステム構築を高速化。",
    category: "デザイン",
    categories: ["デザイン"],
    price: 0,
    version: "2.0.0",
    installs: 4102,
    views: 15800,
    likes: 733,
    author: { name: "Haru Watanabe", handle: "@haru_designs" },
    tags: ["Figma", "配色", "デザインツール"],
    updatedAt: "2026-08-27",
    runtime: "local",
  },
];

export function getToolBySlug(slug: string) {
  return tools.find((t) => t.slug === slug);
}

export function formatPrice(price: number, freeLabel = "無料") {
  return price === 0 ? freeLabel : `¥${price.toLocaleString()}`;
}

export function formatInstalls(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}
