/**
 * 画像URLの検証（サーバー側）。
 *
 * サムネイル・ギャラリー画像は、ブラウザから Supabase Storage に直接アップロードされ、
 * そのURLだけがサーバーに送られてくる。送られてきたURLをそのまま保存すると、
 * 外部サイトの画像（後から差し替えられる・閲覧者を追跡できる）を
 * 審査なしで載せられてしまうため、「本人のフォルダにある BuildBay の画像」だけを受け付ける。
 */

function publicImagePrefix(): string {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
  return `${base}/storage/v1/object/public/tool-images/`;
}

/** 本人（userId）のフォルダにある BuildBay の画像URLか */
export function isOwnToolImageUrl(url: string, userId: string): boolean {
  if (!url || !process.env.NEXT_PUBLIC_SUPABASE_URL) return false;
  if (!url.startsWith(publicImagePrefix() + `${userId}/`)) return false;
  // パスの書き換え（../ など）や、URLに埋め込まれた別の指定を受け付けない
  const rest = url.slice(publicImagePrefix().length);
  return !rest.includes("..") && !/[?#\s"'<>\\]/.test(rest);
}

/** URLの一覧から、本人の画像でないものが含まれていないか */
export function allOwnToolImageUrls(urls: string[], userId: string): boolean {
  return urls.every((u) => isOwnToolImageUrl(u, userId));
}

/**
 * ツール本体のファイルの保存先として正しいか。
 * 「本人のID/ツールのID/…」の形で、パスの書き換えを含まないこと。
 */
export function isValidToolFileKey(key: string, userId: string, toolId: string): boolean {
  if (!key.startsWith(`${userId}/${toolId}/`)) return false;
  return !key.includes("..") && !key.includes("\\") && !key.includes("//");
}

/** アップロード先のフォルダ名に使う短いランダム文字列（同じ場所への上書きを避けるため） */
export function uploadNonce(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 10);
}
