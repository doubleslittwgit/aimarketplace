import Anthropic from "@anthropic-ai/sdk";
import JSZip from "jszip";

export type ToolReview = {
  risk: "low" | "medium" | "high" | "unknown";
  summary: string;
};

// このAIレビューが目を通すファイルの拡張子（実行ファイル本体やバイナリの中身は読めないため対象外）
const READABLE_EXTENSIONS = [
  ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs",
  ".py", ".rb", ".go", ".rs", ".java", ".c", ".cpp", ".cs",
  ".html", ".css", ".json", ".yml", ".yaml", ".toml",
  ".md", ".txt", ".sh", ".ps1", ".bat",
];

const MAX_FILES_READ = 40;
const MAX_TOTAL_CHARS = 60_000; // Claudeに渡すコード量の上限（費用と速度のバランス）

/**
 * アップロードされたZIPの中身（読めるテキストファイルのみ）を展開する。
 * バイナリ（.exeや.app本体など）は文字として読めないため中身は見ず、
 * 「バイナリファイルが含まれる」という事実だけをAIに伝える。
 */
async function extractReadableContents(fileBuffer: Buffer, fileName: string) {
  const isZip = fileName.toLowerCase().endsWith(".zip");
  if (!isZip) {
    return {
      textContent: "",
      fileList: [fileName],
      hasBinary: true,
      note: "ZIP以外の単一ファイル（実行ファイル等）のため、中身の静的解析はできません。",
    };
  }

  try {
    const zip = await JSZip.loadAsync(fileBuffer);
    const entries = Object.values(zip.files).filter((f) => !f.dir);
    const fileList = entries.map((f) => f.name);

    let textContent = "";
    let filesRead = 0;
    let hasBinary = false;

    for (const entry of entries) {
      const lower = entry.name.toLowerCase();
      const isReadable = READABLE_EXTENSIONS.some((ext) => lower.endsWith(ext));

      if (!isReadable) {
        hasBinary = true;
        continue;
      }
      if (filesRead >= MAX_FILES_READ || textContent.length >= MAX_TOTAL_CHARS) {
        continue;
      }

      try {
        const content = await entry.async("string");
        textContent += `\n\n### ${entry.name}\n${content.slice(0, 4000)}`;
        filesRead++;
      } catch {
        // 読めないファイルは無視して続行
      }
    }

    return {
      textContent: textContent.slice(0, MAX_TOTAL_CHARS),
      fileList,
      hasBinary,
      note: null,
    };
  } catch (e) {
    return {
      textContent: "",
      fileList: [fileName],
      hasBinary: true,
      note: `ZIPの展開に失敗しました: ${e instanceof Error ? e.message : "不明なエラー"}`,
    };
  }
}

/**
 * 出品されたツールのファイルをAIに静的に読ませ、レビュー用の所見を作る。
 *
 * 【重要】これはウイルススキャンの代わりではない。
 * コードを実行せず「読んで」判断するだけなので、実行時にしか現れない
 * 挙動や、巧妙に隠された悪意あるコードを見逃す可能性がある。
 * あくまで人間の審査担当者の判断を助ける参考情報であり、
 * 最終判断（公開してよいか）は必ず人間が行う。
 */
export async function reviewToolSubmission(params: {
  toolName: string;
  tagline: string;
  description: string;
  fileBuffer: Buffer | null;
  fileName: string | null;
}): Promise<ToolReview> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      risk: "unknown",
      summary: "ANTHROPIC_API_KEY が未設定のため、AIレビューを実行できませんでした。",
    };
  }

  let extracted: Awaited<ReturnType<typeof extractReadableContents>> | null = null;
  if (params.fileBuffer && params.fileName) {
    extracted = await extractReadableContents(params.fileBuffer, params.fileName);
  }

  const client = new Anthropic({ apiKey });

  const prompt = `あなたはソフトウェア配布マーケットプレイスの出品審査を補助するAIです。
以下に出品されたツールについて、実行はせず「コードを読むだけ」で分かる範囲のリスクを評価してください。

【出品情報】
ツール名: ${params.toolName}
キャッチコピー: ${params.tagline}
詳細説明: ${params.description}

【ファイル一覧】
${extracted?.fileList.join("\n") ?? "（ファイルなし、またはURL提供型）"}

${extracted?.note ? `【注記】${extracted.note}` : ""}
${extracted?.hasBinary ? "【注記】実行可能なバイナリファイルが含まれています。中身は静的に読めません。" : ""}

【読み取れたコードの中身（一部）】
${extracted?.textContent || "（読み取れるテキストファイルがありませんでした）"}

以下の観点で確認し、日本語で簡潔に（400字程度で）報告してください:
- 悪意あるコードの兆候（外部への不審な通信、認証情報の窃取、難読化、バックドア等）
- 出品時の説明文と、実際のコードの内容が一致しているか
- コードの品質・完成度について気づいた点

最後に必ず1行、以下のいずれかの形式で総合判定を書いてください:
RISK: low   （明確な問題は見当たらない）
RISK: medium（気になる点があり、人間の確認を推奨）
RISK: high  （悪意のある可能性が高く、公開すべきでない）`;

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    const riskMatch = text.match(/RISK:\s*(low|medium|high)/i);
    const risk = (riskMatch?.[1]?.toLowerCase() as ToolReview["risk"]) ?? "unknown";

    return { risk, summary: text.trim() };
  } catch (e) {
    return {
      risk: "unknown",
      summary: `AIレビューの実行に失敗しました: ${e instanceof Error ? e.message : "不明なエラー"}`,
    };
  }
}
