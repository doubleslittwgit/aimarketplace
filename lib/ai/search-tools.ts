import Anthropic from "@anthropic-ai/sdk";

export type AiSearchMatch = { slug: string; reason: string };

export type SearchableTool = {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  category: string;
  tags: string[];
};

/**
 * 「毎月の請求書処理が面倒」のような自然な悩み文から、
 * 実際に出品されているツールの中で近いものをAIに選ばせる。
 *
 * ツール数がまだ少ない（数十件規模）マーケットなので、埋め込みベクトル検索の
 * ような仕組みは今のところ不要と判断し、カタログ全件をそのままプロンプトに
 * 含めてAIに選ばせる、一番シンプルな方式にしている。将来ツール数が
 * 大きく増えた場合は、この方式のままだと精度・コストの面で見直しが必要になる。
 */
export async function searchToolsWithAI(
  query: string,
  tools: SearchableTool[]
): Promise<{ matches: AiSearchMatch[]; error: string | null }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { matches: [], error: "ANTHROPIC_API_KEY が未設定のため、AI検索を実行できませんでした。" };
  }
  if (tools.length === 0 || !query.trim()) {
    return { matches: [], error: null };
  }

  const client = new Anthropic({ apiKey });

  const catalog = tools
    .map(
      (t) =>
        `- slug: ${t.slug} / 名前: ${t.name} / キャッチコピー: ${t.tagline} / カテゴリ: ${t.category} / タグ: ${t.tags.join("、") || "なし"} / 説明: ${t.description.slice(0, 200)}`
    )
    .join("\n");

  const prompt = `あなたはAIツールのマーケットプレイスの検索アシスタントです。
利用者が自然な言葉で書いた「困りごと・やりたいこと」に対して、以下のツール一覧から、
実際に役立ちそうなものを最大5件、関連度の高い順に選んでください。
利用者の文章が日本語以外（英語・中国語等）でも、意味を汲み取って判断してください。
本当に関連するものが無ければ、無理に選ばず空にしてください。

【利用者の困りごと】
${query}

【ツール一覧】
${catalog}

以下のJSON配列だけを出力してください（前置きや説明、コードブロックの記法は一切付けない）:
[{"slug": "ここにslug", "reason": "なぜ合うか、20字程度で一言"}]`;

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return { matches: [], error: null };

    const parsed = JSON.parse(jsonMatch[0]) as unknown;
    if (!Array.isArray(parsed)) return { matches: [], error: null };

    const validSlugs = new Set(tools.map((t) => t.slug));
    const matches = parsed
      .filter(
        (m): m is AiSearchMatch =>
          Boolean(m) &&
          typeof (m as AiSearchMatch).slug === "string" &&
          validSlugs.has((m as AiSearchMatch).slug)
      )
      .slice(0, 5);

    return { matches, error: null };
  } catch (e) {
    return {
      matches: [],
      error: `AI検索の実行に失敗しました: ${e instanceof Error ? e.message : "不明なエラー"}`,
    };
  }
}
