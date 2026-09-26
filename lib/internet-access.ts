/**
 * ツールの「インターネット接続が必要か」。
 * ローカル実行・クラウドのどちらのツールにも設定する（DBの tools.internet_access と一致させること）。
 */
export const INTERNET_ACCESS_VALUES = ["required", "partial", "offline"] as const;
export type InternetAccess = (typeof INTERNET_ACCESS_VALUES)[number];

export function parseInternetAccess(value: unknown): InternetAccess | null {
  return typeof value === "string" && (INTERNET_ACCESS_VALUES as readonly string[]).includes(value)
    ? (value as InternetAccess)
    : null;
}
