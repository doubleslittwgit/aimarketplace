/**
 * BuildBay Creativeで扱う「対応ソフト」の一覧。
 * まずは5本に絞って始め、需要を見ながら増やす方針（Shuさんと合意済み）。
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
