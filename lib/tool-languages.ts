/**
 * ツールの対応言語（画面・説明書など）。出品フォームで複数選択する。
 * DBの tools.ui_languages の CHECK 制約と一致させること（supabase/add_tool_ui_languages.sql）。
 *
 * 言語名は、その言語を使う人が一目で分かるよう、その言語自身の表記（English, 한국어 など）で出す。
 * 「その他」だけは画面の言語に合わせて翻訳する。
 */
export const TOOL_LANGUAGES = ["ja", "en", "zh-Hant", "zh-Hans", "ko", "es", "fr", "de", "pt", "other"] as const;
export type ToolLanguage = (typeof TOOL_LANGUAGES)[number];

export const TOOL_LANGUAGE_NATIVE_NAMES: Record<Exclude<ToolLanguage, "other">, string> = {
  ja: "日本語",
  en: "English",
  "zh-Hant": "繁體中文",
  "zh-Hans": "简体中文",
  ko: "한국어",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
  pt: "Português",
};

export function parseToolLanguages(value: unknown): ToolLanguage[] {
  const list = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];
  const set = new Set(list.map((v) => String(v).trim()));
  // 並び順は常に TOOL_LANGUAGES の順にそろえる
  return TOOL_LANGUAGES.filter((l) => set.has(l));
}
