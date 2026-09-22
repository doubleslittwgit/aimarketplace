import ja from "@/messages/ja.json";
import en from "@/messages/en.json";
import zh from "@/messages/zh.json";

/**
 * 通知（アプリ内通知・メール）専用の、軽量な文言取得ヘルパー。
 *
 * next-intlの通常のgetTranslations()は「今リクエストしている人の言語」を
 * 前提にしているが、通知は「操作した人」ではなく「通知を受け取る人」の
 * 言語で出す必要があるため、任意のロケールを指定できる、この専用の
 * シンプルな仕組みを別に用意している。メッセージファイル（messages/*.json）の
 * "notifications" 名前空間をそのまま読み込むので、翻訳の二重管理にはならない。
 */

const MESSAGES: Record<string, unknown> = { ja, en, zh };

function interpolate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? ""));
}

function lookup(locale: string, key: string): unknown {
  const parts = ["notifications", ...key.split(".")];
  let node: unknown = MESSAGES[locale];
  for (const p of parts) {
    if (typeof node !== "object" || node === null) return undefined;
    node = (node as Record<string, unknown>)[p];
  }
  return node;
}

/**
 * "postLiked.title" のようなキーで、指定ロケールの文言を取り出す。
 * そのロケールに無ければ日本語にフォールバックする。
 */
export function tNotif(
  locale: string,
  key: string,
  vars: Record<string, string | number> = {}
): string {
  let value = lookup(locale, key);
  if (typeof value !== "string") value = lookup("ja", key);
  return typeof value === "string" ? interpolate(value, vars) : key;
}
