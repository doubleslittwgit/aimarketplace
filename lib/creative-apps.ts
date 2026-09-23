/**
 * BuildBay Creativeで扱う「対応ソフト」の一覧。
 * 映像・3DCG・ライブビジュアル系の5本で始め、その後DAW（音楽制作）3本を
 * 追加した。カテゴリに「Music」がある以上、音楽系のプラグイン・プリセットを
 * 扱えないのは不自然なため。
 *
 * アイコンは、各ソフトの公式ロゴをそのまま複製すると著作権上の懸念があるため、
 * 実際のロゴ画像は使わず、ブランドカラー＋頭文字の簡易バッジで表現している。
 */
export type CreativeApp = {
  slug: string;
  name: string;
  shortLabel: string;
  descriptionJa: string;
  color: string; // Tailwindのbg-*に使う16進色
};

export const CREATIVE_APPS: CreativeApp[] = [
  {
    slug: "blender",
    name: "Blender",
    shortLabel: "Bl",
    descriptionJa: "3Dモデリング・レンダリング",
    color: "#f5792a",
  },
  {
    slug: "after-effects",
    name: "After Effects",
    shortLabel: "Ae",
    descriptionJa: "モーショングラフィックス",
    color: "#9999ff",
  },
  {
    slug: "cinema-4d",
    name: "Cinema 4D",
    shortLabel: "C4D",
    descriptionJa: "モーショングラフィックス",
    color: "#0eb0e3",
  },
  {
    slug: "premiere-pro",
    name: "Premiere Pro",
    shortLabel: "Pr",
    descriptionJa: "映像編集",
    color: "#9a4bff",
  },
  {
    slug: "touchdesigner",
    name: "TouchDesigner",
    shortLabel: "TD",
    descriptionJa: "リアルタイムビジュアル",
    color: "#00c2b8",
  },
  {
    slug: "ableton-live",
    name: "Ableton Live",
    shortLabel: "Live",
    descriptionJa: "音楽制作・DAW",
    color: "#1a1a1a",
  },
  {
    slug: "fl-studio",
    name: "FL Studio",
    shortLabel: "FL",
    descriptionJa: "音楽制作・DAW",
    color: "#f28c00",
  },
  {
    slug: "logic-pro",
    name: "Logic Pro",
    shortLabel: "Logic",
    descriptionJa: "音楽制作・DAW",
    color: "#6e56cf",
  },
];

export function getCreativeApp(slug: string): CreativeApp | undefined {
  return CREATIVE_APPS.find((a) => a.slug === slug);
}

/** BuildBay Creativeのカテゴリピル（参考画像に準拠） */
export const CREATIVE_CATEGORIES = [
  "Music",
  "3DCG",
  "Motion Graphics",
  "Video Editing",
  "Image Editing",
  "Realtime Visuals",
  "VJ",
  "Game / Realtime",
];

/**
 * これらのカテゴリを1つでも選んだツールは、BuildBay Creative にも表示する。
 * （DBのカテゴリは日本語の文字列で保存している。lib/mock-data.ts の categories と一致させること）
 * 対応ソフト（host_apps）を選んだプラグインとは別に、動画編集ソフトや
 * 簡単な3Dツールのような「単体で動くクリエイティブツール」を拾うための仕組み。
 */
export const CREATIVE_TOOL_CATEGORIES = [
  "クリエイティブ",
  "動画・画像編集",
  "写真",
  "デザイン",
  "音楽・オーディオ",
];

/** そのツールが BuildBay Creative の対象か（プラグイン、またはクリエイティブ系のカテゴリ） */
export function isCreativeTool(tool: { categories?: string[]; hostApps?: string[] }): boolean {
  return (
    (tool.hostApps?.length ?? 0) > 0 ||
    (tool.categories ?? []).some((c) => CREATIVE_TOOL_CATEGORIES.includes(c))
  );
}
