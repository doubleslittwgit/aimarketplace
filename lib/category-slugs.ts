import { categories } from "@/lib/mock-data";

/**
 * カテゴリの表示名を多言語対応させるための対応表。
 *
 * DBには一貫して日本語の文字列（lib/mock-data.tsのcategories配列の値）を
 * 保存・検索キーとして使い続ける（フィルタのURLや既存データとの互換性のため）。
 * 表示するラベルだけを、ここのslugを介して言語ごとに翻訳する。
 *
 * categories配列と同じ並び・同じ件数を保つこと。
 */
/** カテゴリ絞り込みの「すべて」を表す、言語に依存しない内部値（表示ラベルとは別）。 */
export const ALL_CATEGORIES_VALUE = "__all__";

export const CATEGORY_SLUGS = [
  "automation",
  "devTools",
  "dataAnalysis",
  "aiChatbot",
  "videoPhotoEditing",
  "photography",
  "design",
  "writing",
  "music",
  "marketing",
  "socialCommunity",
  "ecommerce",
  "businessProductivity",
  "finance",
  "education",
  "translation",
  "games",
  "lifestyle",
  "health",
  "cooking",
  "travel",
  "parenting",
  "pets",
  "utilities",
  "other",
] as const;

if (CATEGORY_SLUGS.length !== categories.length) {
  throw new Error(
    "CATEGORY_SLUGS と categories の件数が一致していません。両方を同じ並びで更新してください。"
  );
}

const JA_TO_SLUG = new Map<string, string>(
  categories.map((c, i) => [c, CATEGORY_SLUGS[i]])
);

/** DBに保存されている日本語のカテゴリ値から、翻訳キー(slug)を引く。未知の値ならそのまま返す。 */
export function categoryToSlug(categoryJa: string): string {
  return JA_TO_SLUG.get(categoryJa) ?? categoryJa;
}
