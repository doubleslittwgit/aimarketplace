/**
 * DeepL APIラッパー。
 *
 * 出品・レビュー投稿のタイミングで1回だけ呼び出し、結果をDBに
 * キャッシュする設計（毎回のページ表示では呼ばない）。
 * そのため、ここでの失敗は「翻訳が保存されず、閲覧時は日本語のまま
 * 表示される」という結果に留め、出品・投稿自体は失敗させない。
 *
 * 無料版（キーの末尾が :fx）は api-free.deepl.com、
 * 有料版は api.deepl.com を使う。キーの形から自動判定する。
 */

export type SupportedLocale = "en" | "zh";

// このアプリの言語コード → DeepLのターゲット言語コード
const DEEPL_TARGET_LANG: Record<SupportedLocale, string> = {
  en: "EN-US",
  zh: "ZH-HANT", // 繁体字中国語
};

function apiBaseUrl(apiKey: string): string {
  return apiKey.endsWith(":fx") ? "https://api-free.deepl.com" : "https://api.deepl.com";
}

/**
 * 複数のテキストを、指定した言語へまとめて翻訳する。
 * DeepLは1リクエストで複数テキストを送れるので、
 * 「商品名・キャッチコピー・概要」のように関連する文章はまとめて送り、
 * 呼び出し回数と待ち時間を減らす。
 *
 * 失敗時はnullを返す（呼び出し側で「保存しない」判断をしやすくするため）。
 */
export async function translateTexts(
  texts: string[],
  targetLocale: SupportedLocale
): Promise<string[] | null> {
  const apiKey = process.env.DEEPL_API_KEY;
  if (!apiKey) {
    console.warn("[deepl] DEEPL_API_KEY未設定のため翻訳をスキップ");
    return null;
  }

  // 空文字だけのテキストを送ってもDeepL側でエラーになるため、
  // 位置を保ったまま安全に扱う（空はそのまま空として返す）。
  const nonEmptyIndices = texts
    .map((t, i) => (t.trim() ? i : -1))
    .filter((i) => i !== -1);

  if (nonEmptyIndices.length === 0) {
    return texts.map(() => "");
  }

  try {
    const res = await fetch(`${apiBaseUrl(apiKey)}/v2/translate`, {
      method: "POST",
      headers: {
        Authorization: `DeepL-Auth-Key ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: nonEmptyIndices.map((i) => texts[i]),
        source_lang: "JA",
        target_lang: DEEPL_TARGET_LANG[targetLocale],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[deepl] 翻訳リクエストに失敗 (${res.status}): ${body}`);
      return null;
    }

    const data = (await res.json()) as { translations: { text: string }[] };
    const result = texts.map(() => "");
    nonEmptyIndices.forEach((originalIndex, j) => {
      result[originalIndex] = data.translations[j]?.text ?? "";
    });
    return result;
  } catch (e) {
    const message = e instanceof Error ? e.message : "不明なエラー";
    console.error("[deepl] 翻訳中に例外:", message);
    return null;
  }
}

export const SUPPORTED_TRANSLATION_LOCALES: SupportedLocale[] = ["en", "zh"];

/**
 * HTML文書を、タグ構造を保ったまま翻訳する（法務ページ用）。
 * DeepLの tag_handling: "html" オプションにより、タグの中のテキストだけが
 * 翻訳され、h1/ul/strong等の構造はそのまま保たれる。
 */
export async function translateHtml(
  html: string,
  targetLocale: SupportedLocale
): Promise<string | null> {
  const apiKey = process.env.DEEPL_API_KEY;
  if (!apiKey) {
    console.warn("[deepl] DEEPL_API_KEY未設定のため翻訳をスキップ");
    return null;
  }

  try {
    const res = await fetch(`${apiBaseUrl(apiKey)}/v2/translate`, {
      method: "POST",
      headers: {
        Authorization: `DeepL-Auth-Key ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: [html],
        source_lang: "JA",
        target_lang: DEEPL_TARGET_LANG[targetLocale],
        tag_handling: "html",
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[deepl] HTML翻訳リクエストに失敗 (${res.status}): ${body}`);
      return null;
    }

    const data = (await res.json()) as { translations: { text: string }[] };
    return data.translations[0]?.text ?? null;
  } catch (e) {
    const message = e instanceof Error ? e.message : "不明なエラー";
    console.error("[deepl] HTML翻訳中に例外:", message);
    return null;
  }
}
